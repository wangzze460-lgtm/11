# -*- coding: utf-8 -*-
"""
08 本地语音助手（Windows）
唤醒词：08 / 贾维斯   大脑：DeepSeek   语音识别：Vosk 离线中文   语音合成：edge-tts（失败时用系统语音）
"""
import os, sys, json, time, queue, threading, subprocess, webbrowser, shutil, datetime, asyncio, tempfile, re, glob

BASE = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(BASE, "config.json")
MODEL_DIR = os.path.join(BASE, "model")
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
if not os.path.isdir(DESKTOP):
    od = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
    DESKTOP = od if os.path.isdir(od) else os.path.expanduser("~")
UNDO_LOG = os.path.join(BASE, "undo_organize.json")
if sys.stdout is None or sys.stderr is None:   # 无黑窗口模式：输出写到 jarvis.log
    _lf = open(os.path.join(BASE, "jarvis.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stdout or _lf; sys.stderr = sys.stderr or _lf
NOWIN = 0x08000000 if os.name == "nt" else 0

# ---------------- 配置 ----------------
def load_cfg():
    cfg = {"api_key": "", "model": "deepseek-flash", "base_url": "https://api.deepseek.com",
           "voice": "zh-CN-YunxiNeural", "wake_words": ["ling ba", "jia wei si"], "awake_seconds": 10, "call_user": "傅总"}
    if os.path.exists(CFG_PATH):
        with open(CFG_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    if not cfg["api_key"]:
        cfg["api_key"] = ask_key()
        if not cfg["api_key"]:
            sys.exit(0)
        if not cfg["api_key"].startswith("sk-"):
            cfg["base_url"] = "https://open.bigmodel.cn/api/paas/v4/"
            cfg["model"] = "glm-4.7-flash"
            print("识别为智谱免费模型 glm-4.7-flash")
        else:
            print("识别为 DeepSeek")
        with open(CFG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        print("已保存到 config.json（只存在你自己电脑上，想换 Key 就删掉这个文件）")
    return cfg

def ask_key():
    import tkinter as tk
    from tkinter import simpledialog
    r = tk.Tk(); r.withdraw()
    k = simpledialog.askstring("08 第一次使用",
        "粘贴 AI 的 API Key，点确定。\n\n免费：智谱 GLM（bigmodel.cn → API Key 里创建）\n付费更聪明：DeepSeek（sk- 开头）\n\nKey 只保存在你自己电脑的 config.json 里。", parent=r)
    r.destroy()
    return (k or "").strip()

CFG = load_cfg()

def log(who, msg):
    color = {"你": "\033[96m", "MBS": "\033[93m", "系统": "\033[90m", "执行": "\033[92m"}.get(who, "")
    line = f"[{datetime.datetime.now():%H:%M:%S}] {who}：{msg}"
    try: print(line, flush=True)
    except Exception: pass
    try:
        with open(os.path.join(BASE, "jarvis.log"), "a", encoding="utf-8") as f: f.write(line + "\n")
    except Exception: pass
    if who in ("你", "08"):
        UI["bubble"] = (who, msg); UI["bubble_t"] = time.time()

# 界面状态（给卡通小人用）：idle 待机 / listen 在听 / think 思考 / talk 说话
UI = {"state": "idle", "bubble": None, "bubble_t": 0, "type_cb": None}

# ---------------- 语音合成 ----------------
speaking = threading.Event()
def speak(text):
    if not text:
        return
    log("08", text)
    speaking.set(); UI["state"] = "talk"
    try:
        try:
            import edge_tts, pygame
            path = os.path.join(tempfile.gettempdir(), f"jarvis_{int(time.time()*1000)}.mp3")
            asyncio.run(asyncio.wait_for(edge_tts.Communicate(text, CFG["voice"], rate="+8%").save(path), 8))
            pygame.mixer.init()
            pygame.mixer.music.load(path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)
            pygame.mixer.music.unload()
            try: os.remove(path)
            except Exception: pass
        except Exception as e:
            import pyttsx3
            eng = pyttsx3.init()
            eng.say(text)
            eng.runAndWait()
    finally:
        time.sleep(0.25)
        speaking.clear(); UI["state"] = "idle"

# ---------------- 电脑操作工具 ----------------
APP_ALIASES = {
    "记事本": "notepad", "计算器": "calc", "画图": "mspaint", "命令行": "cmd", "终端": "wt",
    "文件管理器": "explorer", "资源管理器": "explorer", "任务管理器": "taskmgr", "设置": "ms-settings:",
    "浏览器": "msedge", "edge": "msedge", "谷歌浏览器": "chrome", "chrome": "chrome",
    "微信": "WeChat", "qq": "QQ", "word": "winword", "excel": "excel", "ppt": "powerpnt",
    "截图工具": "snippingtool", "控制面板": "control", "相机": "microsoft.windows.camera:",
}

def _start(target):
    subprocess.Popen(f'start "" "{target}"', shell=True, creationflags=NOWIN)

BAD_LNK = re.compile(r"卸载|卸載|uninst|uninstall|remove|删除|修复|repair|帮助|help|readme|说明|manual|更新|update|setup|安装", re.I)
def _find_shortcut(name):
    dirs = [DESKTOP, os.path.join(os.environ.get("PUBLIC", ""), "Desktop"),
            os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs"),
            os.path.join(os.environ.get("PROGRAMDATA", ""), r"Microsoft\Windows\Start Menu\Programs")]
    name_l = name.lower().strip()
    if not name_l or BAD_LNK.search(name_l):
        return None
    cands = []
    for d in dirs:
        for p in glob.glob(os.path.join(d, "**", "*.lnk"), recursive=True) + glob.glob(os.path.join(d, "**", "*.url"), recursive=True):
            base = os.path.splitext(os.path.basename(p))[0]
            if BAD_LNK.search(base):          # 永远不打开卸载/安装/更新类快捷方式
                continue
            bl = base.lower()
            if bl == name_l: score = 0
            elif bl.startswith(name_l): score = 1
            elif name_l in bl: score = 2
            else: continue
            cands.append((score, len(base), p))
    return min(cands)[2] if cands else None

def open_app(name):
    key = name.strip().lower()
    lnk = _find_shortcut(name)
    if lnk:
        os.startfile(lnk); return f"已打开 {os.path.basename(lnk)}"
    for k, v in APP_ALIASES.items():
        if k.lower() in key or key in k.lower():
            _start(v); return f"已打开 {k}"
    _start(name)
    return f"已尝试打开 {name}（如果没反应，说明电脑上没找到这个程序）"

def open_url(url):
    if not re.match(r"^https?://", url):
        url = "https://" + url
    webbrowser.open(url); return f"已打开 {url}"

def web_search(query, site="bing"):
    from urllib.parse import quote
    urls = {"bing": "https://www.bing.com/search?q=", "baidu": "https://www.baidu.com/s?wd=",
            "bilibili": "https://search.bilibili.com/all?keyword=", "douyin": "https://www.douyin.com/search/",
            "taobao": "https://s.taobao.com/search?q=", "youtube": "https://www.youtube.com/results?search_query="}
    webbrowser.open(urls.get(site, urls["bing"]) + quote(query)); return f"已在 {site} 搜索：{query}"

def list_desktop():
    items = os.listdir(DESKTOP)
    return "桌面共有 %d 项：%s" % (len(items), "，".join(items[:60]))

CATS = {"图片": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".heic"], "视频": [".mp4", ".mov", ".avi", ".mkv", ".flv", ".webm"],
        "音乐": [".mp3", ".wav", ".flac", ".m4a"], "文档": [".doc", ".docx", ".pdf", ".txt", ".md", ".ppt", ".pptx", ".rtf"],
        "表格": [".xls", ".xlsx", ".csv"], "压缩包": [".zip", ".rar", ".7z", ".tar", ".gz"], "安装包": [".exe", ".msi"]}

def organize_desktop():
    moved = []
    for f in os.listdir(DESKTOP):
        src = os.path.join(DESKTOP, f)
        if not os.path.isfile(src) or f.lower().endswith((".lnk", ".url", ".ini")):
            continue
        ext = os.path.splitext(f)[1].lower()
        cat = next((c for c, exts in CATS.items() if ext in exts), None)
        if not cat:
            continue
        dst_dir = os.path.join(DESKTOP, "整理_" + cat)
        os.makedirs(dst_dir, exist_ok=True)
        dst = os.path.join(dst_dir, f)
        if os.path.exists(dst):
            dst = os.path.join(dst_dir, f"{os.path.splitext(f)[0]}_{int(time.time())}{ext}")
        shutil.move(src, dst); moved.append([src, dst])
    with open(UNDO_LOG, "w", encoding="utf-8") as fp:
        json.dump(moved, fp, ensure_ascii=False)
    return f"整理完成，移动了 {len(moved)} 个文件到“整理_类别”文件夹，快捷方式没动。说“撤销整理”可以还原。"

def undo_organize():
    if not os.path.exists(UNDO_LOG):
        return "没有可撤销的整理记录"
    moved = json.load(open(UNDO_LOG, encoding="utf-8")); n = 0
    for src, dst in moved:
        if os.path.exists(dst) and not os.path.exists(src):
            shutil.move(dst, src); n += 1
    os.remove(UNDO_LOG)
    return f"已还原 {n} 个文件"

def find_file(keyword):
    home = os.path.expanduser("~")
    roots = [DESKTOP] + [os.path.join(home, d) for d in ("Documents", "Downloads", "Pictures", "Videos")]
    hits = []
    for r in roots:
        base_depth = r.rstrip(os.sep).count(os.sep)
        for dp, dn, fn in os.walk(r):
            if dp.count(os.sep) - base_depth >= 3:
                dn[:] = []
            for f in fn + dn:
                if keyword.lower() in f.lower() and len(hits) < 15:
                    hits.append(os.path.join(dp, f))
    return "找到：\n" + "\n".join(hits) if hits else f"没找到包含“{keyword}”的文件"

def open_path(path):
    if not os.path.exists(path):
        return f"路径不存在：{path}"
    os.startfile(path); return f"已打开 {path}"

def create_note(title, content):
    safe = re.sub(r'[\\/:*?"<>|]', "_", title)[:40] or "笔记"
    p = os.path.join(DESKTOP, safe + ".txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    os.startfile(p); return f"已在桌面创建 {safe}.txt"

def type_text(text):
    import pyperclip, pyautogui
    pyperclip.copy(text); time.sleep(0.2); pyautogui.hotkey("ctrl", "v"); return "已输入文字"

def press_keys(keys):
    import pyautogui
    ks = [k.strip().lower() for k in keys.replace("+", " ").split() if k.strip()]
    pyautogui.hotkey(*ks); return "已按下 " + "+".join(ks)

def volume(action, times=5):
    import pyautogui
    key = {"up": "volumeup", "down": "volumedown", "mute": "volumemute"}[action]
    pyautogui.press(key, presses=1 if action == "mute" else max(1, min(int(times), 25))); return "音量已调整"

def media(action):
    import pyautogui
    pyautogui.press({"play_pause": "playpause", "next": "nexttrack", "prev": "prevtrack"}[action]); return "好的"

def _focus_wechat():
    """把微信窗口调到前台（先试快捷键 Ctrl+Alt+W，再试打开程序）"""
    import pyautogui
    try:
        import ctypes
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW("WeChatMainWndForPC", None) or user32.FindWindowW(None, "微信") or user32.FindWindowW(None, "Weixin")
        if hwnd:
            user32.ShowWindow(hwnd, 9); user32.SetForegroundWindow(hwnd); time.sleep(0.6); return True
    except Exception:
        pass
    open_app("微信"); time.sleep(3.5)
    try:
        import ctypes
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW("WeChatMainWndForPC", None) or user32.FindWindowW(None, "微信") or user32.FindWindowW(None, "Weixin")
        if hwnd:
            user32.ShowWindow(hwnd, 9); user32.SetForegroundWindow(hwnd); time.sleep(0.6); return True
    except Exception:
        pass
    pyautogui.hotkey("ctrl", "alt", "w"); time.sleep(1)
    return True

def send_wechat(contact, message):
    import pyperclip, pyautogui
    _focus_wechat()
    pyautogui.hotkey("ctrl", "f"); time.sleep(0.5)
    pyperclip.copy(contact); pyautogui.hotkey("ctrl", "v"); time.sleep(1.5)
    pyautogui.press("enter"); time.sleep(1.0)
    pyperclip.copy(message); pyautogui.hotkey("ctrl", "v"); time.sleep(0.3)
    pyautogui.press("enter")
    return f"已在微信给 {contact} 发送：{message}（如果联系人名字不准，可能发错人，请看一眼）"

def douyin_live(keyword=""):
    from urllib.parse import quote
    if keyword:
        url = "https://www.douyin.com/search/" + quote(keyword) + "?type=live"
    else:
        url = "https://live.douyin.com/"
    lnk = _find_shortcut("抖音") if not keyword else None
    if lnk:
        os.startfile(lnk); return "已打开抖音，点上面的“直播”就能看"
    webbrowser.open(url); return f"已打开抖音直播{('：' + keyword) if keyword else ''}"

def miaoshou(link=""):
    if link:
        import pyperclip; pyperclip.copy(link)
    webbrowser.open("https://erp.91miaoshou.com/")
    return "已打开妙手ERP" + ("，商品链接已复制，到采集框里 Ctrl+V 就能采集上架" if link else "")

# ---------------- 看屏幕自己动手（视觉模型） ----------------
def _shot_b64():
    import pyautogui, io, base64
    im = pyautogui.screenshot()
    W, H = im.size
    im.thumbnail((1280, 1280))
    buf = io.BytesIO(); im.convert("RGB").save(buf, "JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode(), W, H

def screen_task(goal):
    """截图→视觉模型决定点哪里/打什么字→执行，循环直到完成"""
    import pyautogui, pyperclip
    from openai import OpenAI
    if "bigmodel" not in CFG["base_url"]:
        return "看屏幕操作需要智谱的 Key（它有免费视觉模型）"
    client = OpenAI(api_key=CFG["api_key"], base_url=CFG["base_url"])
    done_steps = []
    prompt = ("你在操作一台 Windows 电脑，目标：{goal}\n已做过：{steps}\n"
              "看截图，只输出下一步的一行 JSON，不要别的文字。坐标用 0-1000 的比例（左上角 0,0，右下角 1000,1000）。可选："
              '{{"a":"click","x":数,"y":数}} 单击；{{"a":"double","x":数,"y":数}} 双击；{{"a":"right","x":数,"y":数}} 右键；'
              '{{"a":"type","text":"文字"}} 在当前位置输入；{{"a":"key","keys":"ctrl+c"}} 按键；{{"a":"scroll","n":-5}} 滚动；'
              '{{"a":"wait"}} 等加载；{{"a":"done","say":"一句话汇报"}} 完成或做不到。')
    for step in range(15):
        b64, W, H = _shot_b64()
        msgs = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
            {"type": "text", "text": prompt.format(goal=goal, steps="；".join(done_steps[-8:]) or "无")}]}]
        out = None
        for m in ("glm-4.1v-thinking-flash", "glm-4v-flash"):
            try:
                r = client.chat.completions.create(model=m, messages=msgs, temperature=0.2)
                out = r.choices[0].message.content or ""; break
            except Exception as e:
                log("系统", f"视觉模型 {m}: {e!r}"[:200]); time.sleep(1)
        if out is None:
            return "看屏幕的模型现在用不了，稍后再试"
        mm = re.findall(r"\{[^{}]*\}", out)
        if not mm:
            done_steps.append("（输出无效）"); continue
        try: act = json.loads(mm[-1])
        except Exception: done_steps.append("（输出无效）"); continue
        a = act.get("a")
        X = lambda: int(float(act.get("x", 500)) / 1000 * W)
        Y = lambda: int(float(act.get("y", 500)) / 1000 * H)
        UI["state"] = "think"
        if a == "done":
            return act.get("say", "做完了")
        elif a == "click": pyautogui.click(X(), Y())
        elif a == "double": pyautogui.doubleClick(X(), Y())
        elif a == "right": pyautogui.rightClick(X(), Y())
        elif a == "type": pyperclip.copy(act.get("text", "")); pyautogui.hotkey("ctrl", "v")
        elif a == "key": pyautogui.hotkey(*[k.strip().lower() for k in str(act.get("keys", "")).split("+") if k.strip()])
        elif a == "scroll": pyautogui.scroll(int(act.get("n", -5)) * 100)
        elif a == "wait": time.sleep(2)
        done_steps.append(json.dumps(act, ensure_ascii=False))
        log("执行", done_steps[-1])
        time.sleep(1.2)
    return "步骤太多了，我先做到这里，您看一下屏幕"

def screenshot():
    import pyautogui
    p = os.path.join(DESKTOP, f"截图_{datetime.datetime.now():%Y%m%d_%H%M%S}.png")
    pyautogui.screenshot(p); return f"截图已保存到桌面：{os.path.basename(p)}"

def lock_screen():
    subprocess.Popen("rundll32.exe user32.dll,LockWorkStation", creationflags=NOWIN); return "已锁屏"

def now_time():
    return datetime.datetime.now().strftime("现在是 %Y年%m月%d日 %H:%M，星期") + "一二三四五六日"[datetime.datetime.now().weekday()]

TOOLS_IMPL = {f.__name__: f for f in [screen_task, send_wechat, douyin_live, miaoshou, open_app, open_url, web_search, list_desktop, organize_desktop, undo_organize,
              find_file, open_path, create_note, type_text, press_keys, volume, media, screenshot, lock_screen, now_time]}

def T(name, desc, props=None, req=None):
    return {"type": "function", "function": {"name": name, "description": desc,
            "parameters": {"type": "object", "properties": props or {}, "required": req or []}}}
S = lambda d: {"type": "string", "description": d}
TOOLS = [
    T("screen_task", "看着屏幕自己用鼠标键盘完成任务（点按钮、填表、在网页或软件里一步步操作，其他工具做不了时用它）", {"goal": S("要完成的具体任务，写清楚")}, ["goal"]),
    T("send_wechat", "用电脑微信给某个联系人或群发一条消息", {"contact": S("联系人备注名或群名"), "message": S("要发的内容")}, ["contact", "message"]),
    T("douyin_live", "打开抖音看直播，可带主播名或关键词", {"keyword": S("主播名或直播关键词，可留空")}),
    T("miaoshou", "打开妙手ERP（店铺上架/采集商品/看订单）", {"link": S("要采集上架的商品链接，可留空")}),
    T("open_app", "打开电脑上的软件，如微信、记事本、浏览器、QQ音乐、剪映", {"name": S("软件名")}, ["name"]),
    T("open_url", "用浏览器打开网址", {"url": S("网址")}, ["url"]),
    T("web_search", "在网站上搜索", {"query": S("搜索词"), "site": {"type": "string", "enum": ["bing", "baidu", "bilibili", "douyin", "taobao", "youtube"]}}, ["query"]),
    T("list_desktop", "列出桌面上的文件"),
    T("organize_desktop", "把桌面文件按类型（图片/视频/文档等）归类到文件夹"),
    T("undo_organize", "撤销上一次桌面整理"),
    T("find_file", "在桌面、文档、下载、图片、视频里按名字找文件", {"keyword": S("文件名关键词")}, ["keyword"]),
    T("open_path", "打开某个文件或文件夹的完整路径", {"path": S("完整路径")}, ["path"]),
    T("create_note", "在桌面新建文本文件并写入内容（写文案、清单、笔记）", {"title": S("文件名"), "content": S("内容")}, ["title", "content"]),
    T("type_text", "在当前光标位置输入一段文字", {"text": S("要输入的文字")}, ["text"]),
    T("press_keys", "按快捷键，例如 ctrl+s、alt+tab、win+d", {"keys": S("按键组合")}, ["keys"]),
    T("volume", "调节系统音量", {"action": {"type": "string", "enum": ["up", "down", "mute"]}, "times": {"type": "integer", "description": "每次约2%，默认5"}}, ["action"]),
    T("media", "控制音乐/视频播放", {"action": {"type": "string", "enum": ["play_pause", "next", "prev"]}}, ["action"]),
    T("screenshot", "截取整个屏幕保存到桌面"),
    T("lock_screen", "锁定电脑屏幕"),
    T("now_time", "查询当前日期时间"),
]

SYSTEM = (f"你叫零八（写作08，也可以叫你贾维斯），用户的私人 AI 管家，运行在用户的 Windows 电脑上。称呼用户为“{CFG['call_user']}”。"
          f"回答用简短口语化中文，一般不超过两句话，因为会被朗读出来；不要用 Markdown、列表或表情。"
          f"需要操作电脑时直接调用工具，做完用一句话汇报结果。发微信用 send_wechat，看抖音直播用 douyin_live，妙手上架用 miaoshou；专用工具做不到的界面操作（点按钮、填表、在软件或网页里一步步做）用 screen_task。"
          f"用户桌面路径：{DESKTOP}。"
          f"删除文件、关机等危险操作你没有权限，礼貌说明即可。")

history = [{"role": "system", "content": SYSTEM}]

def ask_ai(client, msgs):
    """智谱免费模型常报 429（太忙），自动重试并换备用免费模型"""
    from openai import RateLimitError, APIStatusError
    models = [CFG["model"]]
    if "bigmodel" in CFG["base_url"]:
        models += [m for m in ["glm-4-flash-250414", "glm-4.7-flash", "glm-4-flash"] if m not in models]
    last = None
    for attempt in range(6):
        m = models[attempt % len(models)]
        kw = {"extra_body": {"thinking": {"type": "disabled"}}} if m.startswith(("glm-4.7", "glm-4.5", "glm-4.6")) else {}
        try:
            return client.chat.completions.create(model=m, messages=msgs, tools=TOOLS, temperature=0.6, **kw)
        except RateLimitError as e:
            last = e; time.sleep(0.8 + attempt * 0.5)
        except APIStatusError as e:
            if e.status_code in (400, 404) and len(models) > 1 and attempt < len(models):
                last = e; continue
            raise
    raise last

def chat(user_text):
    from openai import OpenAI
    client = OpenAI(api_key=CFG["api_key"], base_url=CFG["base_url"])
    history.append({"role": "user", "content": user_text})
    for _ in range(6):
        resp = ask_ai(client, history)
        msg = resp.choices[0].message
        if msg.tool_calls:
            history.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
                {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}} for c in msg.tool_calls]})
            for c in msg.tool_calls:
                try:
                    args = json.loads(c.function.arguments or "{}")
                    result = TOOLS_IMPL[c.function.name](**args)
                except Exception as e:
                    result = f"执行失败：{e}"
                log("执行", f"{c.function.name} → {str(result)[:120]}")
                history.append({"role": "tool", "tool_call_id": c.id, "content": str(result)})
            continue
        reply = (msg.content or "").strip()
        history.append({"role": "assistant", "content": reply})
        if len(history) > 31:
            del history[1:len(history) - 30]
            while history[1]["role"] == "tool": del history[1]
        return reply
    return f"这件事步骤太多了，{CFG['call_user']}，我先做到这里。"

# ---------------- 唤醒词 ----------------
from pypinyin import lazy_pinyin
WAKE = [w.replace(" ", "") for w in CFG["wake_words"]] + ["lingba"]
def split_wake(text):
    """返回 (是否唤醒, 唤醒词之后的内容)。唤醒词：08（主）、贾维斯（备用）"""
    t = re.sub(r"\s+", "", text)
    py = lazy_pinyin(t)  # 每个汉字一个音节
    joined = ""; idx = []
    for i, p in enumerate(py):
        idx.append(len(joined)); joined += p
    best = None
    for w in WAKE + ["lingba", "linba", "lingpa", "dongba", "0ba", "08", "ling8", "liangba", "jiaweisi", "jiaweishi", "jiaweis", "jiawisi", "jiawei"]:
        pos = joined.find(w)
        if pos >= 0 and (best is None or pos < best[0]):
            best = (pos, pos + len(w))
    if best is None or best[0] > len("heiheihei"):   # 名字要在句子开头附近
        return False, ""
    end = best[1]
    while True:   # 连喊两遍“0808”也去掉
        nxt = joined.find("lingba", end)
        if nxt != end: break
        end += len("lingba")
    k = next((i for i, s in enumerate(idx) if s >= end), len(t))
    return True, t[k:].lstrip("，,。啊呀 ")

# ---------------- 主循环（Vosk 离线识别） ----------------
def voice_loop():
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer, SetLogLevel
    SetLogLevel(-1)
    if not os.path.isdir(MODEL_DIR):
        log("08", "没找到语音模型 model 文件夹，请把整个文件夹解压完整再打开。"); return
    model = Model(MODEL_DIR)
    rec = KaldiRecognizer(model, 16000)
    q = queue.Queue()
    def cb(indata, frames, t, status):
        if not speaking.is_set():
            q.put(bytes(indata))
    speak(f"08已上线，随时为您服务，{CFG['call_user']}。")
    awake_until = 0
    with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype="int16", channels=1, callback=cb):
        while True:
            data = q.get()
            if speaking.is_set():
                continue
            if not rec.AcceptWaveform(data):
                continue
            text = json.loads(rec.Result()).get("text", "").replace(" ", "")
            if not text:
                continue
            woke, rest = split_wake(text)
            UI["awake_until"] = awake_until
            if woke:
                log("你", text)
                if rest and len(rest) >= 2:
                    handle(rest); awake_until = time.time() + CFG["awake_seconds"]
                else:
                    speak(f"我在，{CFG['call_user']}。"); awake_until = time.time() + CFG["awake_seconds"]
                drain(q, rec)
            elif time.time() < awake_until and len(text) >= 2:
                log("你", text)
                handle(text); awake_until = time.time() + CFG["awake_seconds"]
                drain(q, rec)
            else:
                log("系统", f"（听到：{text}，没叫08，忽略）")
                UI["bubble"] = ("听到", f"{text}（先叫“08”哦）"); UI["bubble_t"] = time.time()

def drain(q, rec):
    while not q.empty():
        q.get_nowait()
    rec.Reset()

busy = threading.Lock()
def handle(text):
    with busy:
        if re.search(r"(退出|关闭)(程序|贾维斯|08)|再见(贾维斯|08)", text):
            speak(f"好的{CFG['call_user']}，再见。"); os._exit(0)
        UI["state"] = "think"
        try:
            reply = chat(text)
        except Exception as e:
            er = repr(e)
            if "401" in er or "Authentication" in er:
                reply = f"{CFG['call_user']}，API Key 不对或者已经被删了。右键点我，选“更换 API Key”，重新粘贴一个。"
            elif "429" in er or "RateLimit" in er:
                reply = f"抱歉{CFG['call_user']}，免费 AI 现在太忙，请过几秒再说一遍。"
            elif "Connection" in er or "Timeout" in er:
                reply = f"抱歉{CFG['call_user']}，连不上 AI 服务器，检查一下网络或者代理。"
            else:
                reply = f"抱歉{CFG['call_user']}，AI 出错了：{er[:60]}"
            log("系统", repr(e))
        speak(reply)

# ---------------- 桌面卡通小人 ----------------
KEY = "#01ff02"   # 透明色
class Buddy:
    W, H = 280, 430
    def __init__(self):
        import tkinter as tk
        self.tk = tk
        self.root = r = tk.Tk()
        r.title("08"); r.overrideredirect(True); r.attributes("-topmost", True)
        r.configure(bg=KEY)
        try: r.attributes("-transparentcolor", KEY)
        except Exception: pass
        sw, sh = r.winfo_screenwidth(), r.winfo_screenheight()
        r.geometry(f"{self.W}x{self.H}+{sw - self.W - 30}+{sh - self.H - 60}")
        self.c = tk.Canvas(r, width=self.W, height=self.H, bg=KEY, highlightthickness=0)
        self.c.pack()
        self.font = ("Microsoft YaHei UI", 11)
        self.imgs = {}
        ad = os.path.join(BASE, "avatar")
        for st in ("idle", "listen", "think", "talk", "talk2"):
            for ext in ("png", "gif"):
                fp = os.path.join(ad, f"{st}.{ext}")
                if os.path.exists(fp):
                    try:
                        im = tk.PhotoImage(file=fp)
                        f = max(1, max(im.width() // 260, im.height() // 290) + (1 if max(im.width(), im.height()) > 290 else 0))
                        self.imgs[st] = im.subsample(f) if f > 1 else im
                    except Exception as e:
                        log("系统", f"头像图片读不了 {fp}: {e}")
                    break
        self.t0 = time.time(); self.blink_at = time.time() + 3
        self.c.bind("<ButtonPress-1>", self._press); self.c.bind("<B1-Motion>", self._drag)
        self.c.bind("<Double-Button-1>", lambda e: self.type_box())
        self.c.bind("<Button-3>", self._menu)
        self.m = tk.Menu(r, tearoff=0, font=self.font)
        self.m.add_command(label="⌨  打字跟08说", command=self.type_box)
        self.m.add_command(label="🔑  更换 API Key", command=self.change_key)
        self.m.add_command(label="🙈  隐藏 10 分钟", command=lambda: (r.withdraw(), r.after(600000, r.deiconify)))
        self.m.add_separator()
        self.m.add_command(label="❌  退出08", command=lambda: os._exit(0))
        self.tick()

    def _press(self, e): self._dx, self._dy = e.x, e.y
    def _drag(self, e):
        self.root.geometry(f"+{self.root.winfo_x() + e.x - self._dx}+{self.root.winfo_y() + e.y - self._dy}")
    def _menu(self, e): self.m.tk_popup(e.x_root, e.y_root)

    def type_box(self):
        from tkinter import simpledialog
        t = simpledialog.askstring("跟08说", f"{CFG['call_user']}，想让我做什么？", parent=self.root)
        if t and t.strip():
            log("你", t.strip())
            threading.Thread(target=handle, args=(t.strip(),), daemon=True).start()

    def change_key(self):
        from tkinter import simpledialog
        k = simpledialog.askstring("更换 API Key", "粘贴新的 API Key（智谱或 DeepSeek）：", parent=self.root)
        if not k or not k.strip(): return
        k = k.strip()
        CFG["api_key"] = k
        if k.startswith("sk-"):
            CFG["base_url"], CFG["model"] = "https://api.deepseek.com", "deepseek-flash"
        else:
            CFG["base_url"], CFG["model"] = "https://open.bigmodel.cn/api/paas/v4/", "glm-4.7-flash"
        with open(CFG_PATH, "w", encoding="utf-8") as f:
            json.dump(CFG, f, ensure_ascii=False, indent=2)
        log("08", f"新 Key 已保存，{CFG['call_user']}，再跟我说一遍吧。")

    # ---- 画小人（小新风格：土豆脸、粗眉毛、红上衣、黄短裤）----
    def draw_kid(self, st, now):
        c = self.c
        bob = 3 * __import__("math").sin((now - self.t0) * (6 if st == "talk" else 2))
        if st == "listen": bob -= 6
        ox, oy = 140, 300 + bob
        blink = now >= self.blink_at
        if now > self.blink_at + 0.15: self.blink_at = now + 2.5 + (hash(int(now)) % 30) / 10
        # 腿和鞋
        for dx in (-22, 14):
            c.create_rectangle(ox + dx, oy + 95, ox + dx + 10, oy + 118, fill="#ffd9b8", outline="#333", width=2)
            c.create_oval(ox + dx - 6, oy + 112, ox + dx + 18, oy + 124, fill="#ffffff", outline="#333", width=2)
        # 黄短裤
        c.create_polygon(ox - 38, oy + 70, ox + 38, oy + 70, ox + 36, oy + 100, ox + 4, oy + 100, ox, oy + 88,
                         ox - 4, oy + 100, ox - 36, oy + 100, fill="#ffd21f", outline="#333", width=2)
        # 红上衣
        c.create_polygon(ox - 30, oy + 18, ox + 30, oy + 18, ox + 42, oy + 74, ox - 42, oy + 74,
                         fill="#e8322b", outline="#333", width=2, smooth=False)
        # 手臂（说话时挥手）
        wave = 14 * __import__("math").sin((now - self.t0) * 10) if st == "talk" else 0
        c.create_line(ox - 30, oy + 26, ox - 52, oy + 58, width=9, fill="#e8322b", capstyle="round")
        c.create_oval(ox - 60, oy + 52, ox - 44, oy + 68, fill="#ffd9b8", outline="#333", width=2)
        hx, hy = (ox + 60, oy - 4 - wave) if st in ("talk", "listen") else (ox + 52, oy + 58)
        c.create_line(ox + 30, oy + 26, hx - 4, hy + 6, width=9, fill="#e8322b", capstyle="round")
        c.create_oval(hx - 8, hy - 2, hx + 8, hy + 14, fill="#ffd9b8", outline="#333", width=2)
        # 头：土豆形
        hy0 = oy - 4
        c.create_polygon(ox - 62, hy0 - 40, ox - 40, hy0 - 92, ox + 30, hy0 - 96, ox + 66, hy0 - 52,
                         ox + 60, hy0 + 6, ox + 20, hy0 + 26, ox - 40, hy0 + 20, ox - 66, hy0 - 6,
                         fill="#ffd9b8", outline="#333", width=2, smooth=True)
        # 头发
        c.create_polygon(ox - 60, hy0 - 44, ox - 40, hy0 - 92, ox + 30, hy0 - 96, ox + 64, hy0 - 56,
                         ox + 48, hy0 - 62, ox + 10, hy0 - 66, ox - 30, hy0 - 60, ox - 50, hy0 - 30,
                         fill="#1e1e1e", outline="#1e1e1e", smooth=True)
        # 粗眉毛
        lift = -6 if st == "listen" else (-3 if st == "think" else 0)
        for ex in (-30, 14):
            c.create_line(ox + ex, hy0 - 44 + lift, ox + ex + 20, hy0 - 46 + lift, width=8, fill="#1e1e1e", capstyle="round")
        # 眼睛
        look = 5 if st == "think" else 0
        for ex in (-22, 22):
            if blink:
                c.create_line(ox + ex - 8, hy0 - 26, ox + ex + 8, hy0 - 26, width=3, fill="#1e1e1e")
            else:
                c.create_oval(ox + ex - 9, hy0 - 38, ox + ex + 9, hy0 - 14, fill="#ffffff", outline="#1e1e1e", width=2)
                c.create_oval(ox + ex - 5 + look, hy0 - 32 - look, ox + ex + 5 + look, hy0 - 20 - look, fill="#1e1e1e", outline="")
                c.create_oval(ox + ex - 2 + look, hy0 - 30 - look, ox + ex + 1 + look, hy0 - 27 - look, fill="#ffffff", outline="")
        # 腮红
        for ex in (-44, 34):
            c.create_oval(ox + ex, hy0 - 10, ox + ex + 14, hy0 - 2, fill="#ffa3a3", outline="")
        # 嘴
        if st == "talk" and int(now * 8) % 2 == 0:
            c.create_oval(ox - 9, hy0 - 4, ox + 9, hy0 + 12, fill="#c0392b", outline="#333", width=2)
        elif st == "think":
            c.create_line(ox - 6, hy0 + 4, ox + 8, hy0 + 2, width=3, fill="#333")
        else:
            c.create_arc(ox - 12, hy0 - 10, ox + 12, hy0 + 8, start=200, extent=140, style="arc", width=3, outline="#333")
        # 状态小标
        if st == "listen":
            c.create_text(ox + 64, hy0 - 96, text="👂", font=("Segoe UI Emoji", 20))
        elif st == "think":
            dots = "." * (1 + int(now * 3) % 3)
            c.create_text(ox + 70, hy0 - 96, text="🤔" + dots, font=("Segoe UI Emoji", 16), anchor="w")

    def draw_bubble(self, now):
        b = UI.get("bubble")
        if not b or now - UI["bubble_t"] > 12: return
        who, msg = b
        if len(msg) > 90: msg = msg[:88] + "…"
        txt = {"你": "你：", "听到": "我听到："}.get(who, "") + msg
        t = self.c.create_text(140, 16, text=txt, font=self.font, width=240, anchor="n",
                               fill="#555" if who == "你" else "#111")
        x1, y1, x2, y2 = self.c.bbox(t)
        bg = "#eaf4ff" if who == "你" else "#ffffff"
        r = self.c.create_rectangle(x1 - 12, y1 - 8, x2 + 12, y2 + 8, fill=bg, outline="#333", width=2)
        tail = self.c.create_polygon(130, y2 + 7, 150, y2 + 7, 138, y2 + 24, fill=bg, outline="#333", width=2)
        self.c.create_line(131, y2 + 8, 149, y2 + 8, fill=bg, width=3)
        self.c.tag_lower(tail); self.c.tag_lower(r)

    def tick(self):
        now = time.time()
        st = UI["state"]
        if st == "idle" and now < UI.get("awake_until", 0): st = "listen"
        self.c.delete("all")
        img = None
        if self.imgs:
            key = st
            if st == "talk" and "talk2" in self.imgs and int(now * 6) % 2: key = "talk2"
            img = self.imgs.get(key) or self.imgs.get("idle") or next(iter(self.imgs.values()))
        if img is not None:
            bob = 4 * __import__("math").sin((now - self.t0) * (8 if st == "talk" else 2))
            self.c.create_image(140, self.H - 6 + bob, image=img, anchor="s")
        else:
            self.draw_kid(st, now)
        self.draw_bubble(now)
        self.root.after(70, self.tick)

def run_voice():
    try:
        voice_loop()
    except Exception as e:
        log("系统", repr(e))
        msg = str(e)
        UI["state"] = "idle"
        log("08", f"{CFG['call_user']}，麦克风打不开（{msg[:40]}）。可以双击我打字。" if "PortAudio" in msg or "device" in msg.lower()
            else f"{CFG['call_user']}，语音出了点问题，可以双击我打字。")

def main():
    buddy = Buddy()
    threading.Thread(target=run_voice, daemon=True).start()
    buddy.root.mainloop()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback; traceback.print_exc()
        try:
            from tkinter import messagebox; messagebox.showerror("08出错了", repr(e))
        except Exception: pass
