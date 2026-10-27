# -*- coding: utf-8 -*-
"""
JARVIS 本地语音助手（Windows）
唤醒词：贾维斯   大脑：DeepSeek   语音识别：Vosk 离线中文   语音合成：edge-tts（失败时用系统语音）
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

# ---------------- 配置 ----------------
def load_cfg():
    cfg = {"api_key": "", "model": "deepseek-flash", "base_url": "https://api.deepseek.com",
           "voice": "zh-CN-YunxiNeural", "wake_words": ["jia wei si"], "awake_seconds": 10, "call_user": "傅总"}
    if os.path.exists(CFG_PATH):
        with open(CFG_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    if not cfg["api_key"]:
        print("\n第一次使用：粘贴 AI 的 API Key，回车确认。")
        print("  免费：智谱 GLM（bigmodel.cn 注册，在 API Keys 里创建）")
        print("  付费更聪明：DeepSeek（platform.deepseek.com，sk- 开头）")
        cfg["api_key"] = input("> ").strip()
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

CFG = load_cfg()

def log(who, msg):
    color = {"你": "\033[96m", "MBS": "\033[93m", "系统": "\033[90m", "执行": "\033[92m"}.get(who, "")
    print(f"{color}[{datetime.datetime.now():%H:%M:%S}] {who}：{msg}\033[0m", flush=True)

# ---------------- 语音合成 ----------------
speaking = threading.Event()
def speak(text):
    if not text:
        return
    log("MBS", text)
    speaking.set()
    try:
        try:
            import edge_tts, pygame
            path = os.path.join(tempfile.gettempdir(), f"jarvis_{int(time.time()*1000)}.mp3")
            asyncio.run(edge_tts.Communicate(text, CFG["voice"], rate="+8%").save(path))
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
        speaking.clear()

# ---------------- 电脑操作工具 ----------------
APP_ALIASES = {
    "记事本": "notepad", "计算器": "calc", "画图": "mspaint", "命令行": "cmd", "终端": "wt",
    "文件管理器": "explorer", "资源管理器": "explorer", "任务管理器": "taskmgr", "设置": "ms-settings:",
    "浏览器": "msedge", "edge": "msedge", "谷歌浏览器": "chrome", "chrome": "chrome",
    "微信": "WeChat", "qq": "QQ", "word": "winword", "excel": "excel", "ppt": "powerpnt",
    "截图工具": "snippingtool", "控制面板": "control", "相机": "microsoft.windows.camera:",
}

def _start(target):
    subprocess.Popen(f'start "" "{target}"', shell=True)

def _find_shortcut(name):
    dirs = [os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs"),
            os.path.join(os.environ.get("PROGRAMDATA", ""), r"Microsoft\Windows\Start Menu\Programs"), DESKTOP,
            os.path.join(os.environ.get("PUBLIC", ""), "Desktop")]
    name_l = name.lower()
    for d in dirs:
        for p in glob.glob(os.path.join(d, "**", "*.lnk"), recursive=True) + glob.glob(os.path.join(d, "**", "*.url"), recursive=True):
            if name_l in os.path.splitext(os.path.basename(p))[0].lower():
                return p
    return None

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

def screenshot():
    import pyautogui
    p = os.path.join(DESKTOP, f"截图_{datetime.datetime.now():%Y%m%d_%H%M%S}.png")
    pyautogui.screenshot(p); return f"截图已保存到桌面：{os.path.basename(p)}"

def lock_screen():
    subprocess.Popen("rundll32.exe user32.dll,LockWorkStation"); return "已锁屏"

def now_time():
    return datetime.datetime.now().strftime("现在是 %Y年%m月%d日 %H:%M，星期") + "一二三四五六日"[datetime.datetime.now().weekday()]

TOOLS_IMPL = {f.__name__: f for f in [open_app, open_url, web_search, list_desktop, organize_desktop, undo_organize,
              find_file, open_path, create_note, type_text, press_keys, volume, media, screenshot, lock_screen, now_time]}

def T(name, desc, props=None, req=None):
    return {"type": "function", "function": {"name": name, "description": desc,
            "parameters": {"type": "object", "properties": props or {}, "required": req or []}}}
S = lambda d: {"type": "string", "description": d}
TOOLS = [
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

SYSTEM = (f"你叫 MBS（也可以叫你贾维斯），用户的私人 AI 管家，运行在用户的 Windows 电脑上。称呼用户为“{CFG['call_user']}”。"
          f"回答用简短口语化中文，一般不超过两句话，因为会被朗读出来；不要用 Markdown、列表或表情。"
          f"需要操作电脑时直接调用工具，做完用一句话汇报结果。用户桌面路径：{DESKTOP}。"
          f"删除文件、关机等危险操作你没有权限，礼貌说明即可。")

history = [{"role": "system", "content": SYSTEM}]

def chat(user_text):
    from openai import OpenAI
    client = OpenAI(api_key=CFG["api_key"], base_url=CFG["base_url"])
    history.append({"role": "user", "content": user_text})
    for _ in range(6):
        resp = client.chat.completions.create(model=CFG["model"], messages=history, tools=TOOLS, temperature=0.6,
                                              extra_body={"thinking": {"type": "disabled"}})
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
WAKE = [w.replace(" ", "") for w in CFG["wake_words"]]
MBS_PRE = {"hei", "hai", "an", "dan", "en", "wan", "ai", "em"}
MBS_POST = {"si", "shi", "ai", "an"}
def _mbs(py):
    """在开头找 MBS（Vosk 常听成：必死 / 但必死 / 但彼岸 / 完毕 / 黑暗必死）。返回唤醒词占的音节数，没有返回 0"""
    for start in range(0, min(3, len(py))):
        if py[start] != "bi":
            continue
        pre = py[:start]
        if any(p not in MBS_PRE for p in pre):
            continue
        n = start + 1
        if n < len(py) and py[n] in MBS_POST:
            return n + 1
        if pre:
            return n
    return 0
def split_wake(text):
    """返回 (是否唤醒, 唤醒词之后的内容)"""
    t = re.sub(r"\s+", "", text)
    low = t.lower()
    m = re.match(r"(hey|嘿)?m\s*b\s*s", low)
    if m:
        return True, t[m.end():].lstrip("，,。 ")
    py = lazy_pinyin(t)  # 每个汉字一个音节
    k = _mbs(py)
    if k:
        return True, t[k:].lstrip("，,。 ")
    joined = ""; idx = []
    for i, p in enumerate(py):
        idx.append(len(joined)); joined += p
    for w in WAKE + ["jiaweisi", "jiaweishi", "jiaweis", "jiawisi"]:
        pos = joined.find(w)
        if pos >= 0:
            end = pos + len(w)
            k = next((i for i, s in enumerate(idx) if s >= end), len(t))
            return True, t[k:].lstrip("，,。 ")
    return False, ""

# ---------------- 主循环（Vosk 离线识别） ----------------
def main():
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer, SetLogLevel
    SetLogLevel(-1)
    if not os.path.isdir(MODEL_DIR):
        print("没找到语音模型 model 文件夹，请确认 model 文件夹和程序在同一个目录"); input(); return
    model = Model(MODEL_DIR)
    rec = KaldiRecognizer(model, 16000)
    q = queue.Queue()
    def cb(indata, frames, t, status):
        if not speaking.is_set():
            q.put(bytes(indata))
    print("\n" + "=" * 46 + "\n  J.A.R.V.I.S. 已启动  —— 说「MBS」或「贾维斯」唤醒\n  也可以直接在这个窗口打字回车\n" + "=" * 46 + "\n")
    threading.Thread(target=keyboard_loop, daemon=True).start()
    speak(f"MBS 已上线，随时为您服务，{CFG['call_user']}。")
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
                log("系统", f"（听到：{text}，没叫 MBS，忽略）")

def drain(q, rec):
    while not q.empty():
        q.get_nowait()
    rec.Reset()

busy = threading.Lock()
def handle(text):
    with busy:
        if re.search(r"(退出|关闭)(程序|贾维斯|MBS)|再见(贾维斯|MBS)", text):
            speak(f"好的{CFG['call_user']}，再见。"); os._exit(0)
        try:
            reply = chat(text)
        except Exception as e:
            reply = f"抱歉{CFG['call_user']}，连接 AI 失败了，请检查网络或 API Key。"
            log("系统", repr(e))
        speak(reply)

def keyboard_loop():
    while True:
        try:
            s = input().strip()
        except EOFError:
            return
        if s:
            log("你", s + "（打字）"); handle(s)

if __name__ == "__main__":
    os.system("")  # 开启 Windows 终端颜色
    try:
        main()
    except Exception as e:
        print("出错了：", repr(e)); input("按回车退出")
