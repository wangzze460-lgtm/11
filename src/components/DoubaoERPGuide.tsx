import { useState } from 'react';
import { Copy, CheckCircle, MessageCircle, Sparkles, ArrowRight, Bot, Code, Database } from 'lucide-react';
import { generateDoubaoPrompt, generateSimplePrompt } from '../utils/doubaoPrompt';

export default function DoubaoERPGuide() {
  const [copied, setCopied] = useState<string | null>(null);
  const [promptType, setPromptType] = useState<'detailed' | 'simple'>('detailed');
  const [techStack, setTechStack] = useState('不确定');
  const [database, setDatabase] = useState('MySQL');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentPrompt = promptType === 'detailed' 
    ? generateDoubaoPrompt({ techStack, database })
    : generateSimplePrompt();

  const steps = [
    {
      num: 1,
      title: '复制下面的提示词',
      desc: '点击复制按钮，复制给豆包的提示词',
      icon: <Copy size={20} />,
    },
    {
      num: 2,
      title: '发给豆包',
      desc: '打开豆包，把提示词发给它，让它帮你写接口',
      icon: <MessageCircle size={20} />,
    },
    {
      num: 3,
      title: '豆包会给你接口地址和 Token',
      desc: '豆包写好后会告诉你接口 URL 和认证 Token',
      icon: <Bot size={20} />,
    },
    {
      num: 4,
      title: '在工具里配置',
      desc: '把接口地址和 Token 填到「ERP 对接」页面',
      icon: <Code size={20} />,
    },
    {
      num: 5,
      title: '开启自动推送',
      desc: '采集链接后会自动发送到你的 ERP',
      icon: <Sparkles size={20} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">豆包 ERP 对接指南</h3>
            <p className="text-blue-100 text-sm">
              你的 ERP 是豆包做的？太简单了！只需要让豆包加一个接收接口就行。
              我帮你写好了提示词，复制发给豆包，它会自动帮你写好。
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">📋 操作步骤</h4>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {step.num}
              </div>
              <div className="flex-1 pt-1">
                <p className="font-medium text-gray-800 text-sm">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <MessageCircle size={18} className="text-blue-500" />
            发给豆包的提示词
          </h4>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPromptType('detailed')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                promptType === 'detailed' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
              }`}
            >
              详细版
            </button>
            <button
              onClick={() => setPromptType('simple')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                promptType === 'simple' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
              }`}
            >
              简洁版
            </button>
          </div>
        </div>

        {/* Options for detailed version */}
        {promptType === 'detailed' && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">技术栈（可选）</label>
              <select
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              >
                <option value="不确定">不确定 / 让豆包自己选</option>
                <option value="Node.js + Express">Node.js + Express</option>
                <option value="Python + Flask">Python + Flask</option>
                <option value="Python + Django">Python + Django</option>
                <option value="Java + Spring Boot">Java + Spring Boot</option>
                <option value="PHP + Laravel">PHP + Laravel</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">数据库（可选）</label>
              <select
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              >
                <option value="MySQL">MySQL</option>
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MongoDB">MongoDB</option>
                <option value="SQLite">SQLite</option>
              </select>
            </div>
          </div>
        )}

        {/* Prompt Content */}
        <div className="relative">
          <pre className="bg-gray-900 rounded-xl p-4 overflow-x-auto text-xs text-gray-300 font-mono max-h-96 overflow-y-auto whitespace-pre-wrap">
            {currentPrompt}
          </pre>
          <button
            onClick={() => copyText(currentPrompt, 'prompt')}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copied === 'prompt'
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {copied === 'prompt' ? (
              <>
                <CheckCircle size={14} />
                已复制
              </>
            ) : (
              <>
                <Copy size={14} />
                复制提示词
              </>
            )}
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-700 flex items-start gap-2">
            <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>使用方法：</strong>复制上面的提示词 → 打开豆包 → 粘贴发送 → 豆包会帮你写好接口 → 
              把豆包给你的接口地址和 Token 填到下面的配置里
            </span>
          </p>
        </div>
      </div>

      {/* After Doubao Response */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ArrowRight size={18} className="text-green-500" />
          豆包给你接口后，在这里配置
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">接口地址（豆包给你的 URL）</label>
            <input
              type="text"
              placeholder="例如：https://your-erp.com/api/products/collect"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bearer Token（豆包给你的 Token）</label>
            <input
              type="text"
              placeholder="例如：abc123xyz456"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none font-mono"
            />
          </div>
          <p className="text-xs text-gray-500">
            💡 拿到豆包给的地址和 Token 后，去「ERP 对接配置」页面添加 ERP，选择「通用 API」模板，填入这些信息即可。
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">❓ 常见问题</h4>
        <div className="space-y-3">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span className="text-sm font-medium text-gray-700">豆包问我技术栈怎么办？</span>
              <span className="text-xs text-gray-400">点击展开</span>
            </summary>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
              告诉豆包：「你看着办，用你最熟悉的技术栈就行」，它会自动选择合适的。
            </div>
          </details>
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span className="text-sm font-medium text-gray-700">豆包写好后我怎么测试？</span>
              <span className="text-xs text-gray-400">点击展开</span>
            </summary>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
              让豆包给你测试命令，或者在本工具的「ERP 对接配置」页面点击「测试连接」按钮。
            </div>
          </details>
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span className="text-sm font-medium text-gray-700">接口地址是什么格式？</span>
              <span className="text-xs text-gray-400">点击展开</span>
            </summary>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
              通常是 https://你的域名/api/products/collect 这样的格式。如果是本地测试，可能是 http://localhost:3000/api/products/collect。
            </div>
          </details>
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span className="text-sm font-medium text-gray-700">Token 是什么？</span>
              <span className="text-xs text-gray-400">点击展开</span>
            </summary>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
              Token 是一串随机字符，用来验证请求是否合法。豆包会生成一个给你，类似：abc123xyz456。在配置时填入这个 Token 就行。
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
