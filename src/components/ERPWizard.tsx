import { useState } from 'react';
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft, Copy, CheckCircle2,
  Server, Globe, Key, Code, FileText, HelpCircle, MessageCircle,
  Terminal, Database, Cloud, Monitor, ChevronDown, ChevronUp
} from 'lucide-react';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function ERPWizard() {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      title: '你的 ERP 是什么？',
      icon: <Server size={24} />,
      color: 'from-purple-500 to-indigo-500',
    },
    {
      title: '你的 ERP 用什么技术开发的？',
      icon: <Code size={24} />,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: '你的 ERP 有 API 接口吗？',
      icon: <Globe size={24} />,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: '你的 ERP 部署在哪里？',
      icon: <Cloud size={24} />,
      color: 'from-orange-500 to-amber-500',
    },
    {
      title: '生成对接方案',
      icon: <FileText size={24} />,
      color: 'from-pink-500 to-rose-500',
    },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-gray-600">选择最接近你情况的选项：</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { key: 'commercial', label: '买的现成 ERP', desc: '马帮/通途/店小秘/万邑通/赛盒等', icon: '🏪' },
                { key: 'self_built', label: '自己开发的 ERP', desc: '找程序员做的/自己写的', icon: '💻' },
                { key: 'outsourced', label: '外包开发的 ERP', desc: '找外包公司做的', icon: '🤝' },
                { key: 'not_sure', label: '不太清楚', desc: '别人帮我弄的，我不太懂', icon: '🤔' },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => { setAnswers({ ...answers, erpType: option.key }); setCurrentStep(1); }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    answers.erpType === option.key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <span className="text-3xl">{option.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <p className="text-gray-600">你的 ERP 是用什么语言/框架开发的？（问你的程序员就知道）</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'java', label: 'Java', desc: 'Spring Boot', icon: '☕' },
                { key: 'nodejs', label: 'Node.js', desc: 'Express/Nest.js', icon: '🟢' },
                { key: 'python', label: 'Python', desc: 'Django/Flask', icon: '🐍' },
                { key: 'php', label: 'PHP', desc: 'Laravel/ThinkPHP', icon: '🐘' },
                { key: 'go', label: 'Go', desc: 'Gin/Beego', icon: '🔵' },
                { key: 'dotnet', label: '.NET/C#', desc: 'ASP.NET', icon: '🟣' },
                { key: 'other', label: '其他', desc: 'Ruby/Rust/...', icon: '🔧' },
                { key: 'unknown', label: '不知道', desc: '我不清楚', icon: '❓' },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => { setAnswers({ ...answers, techStack: option.key }); setCurrentStep(2); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    answers.techStack === option.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-gray-600">你的 ERP 有 API 接口吗？（就是程序之间互相通信的接口）</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  key: 'has_api',
                  label: '有 API 接口',
                  desc: '程序员已经写好了接口，有接口文档',
                  icon: '✅',
                  detail: '如果有，请提供：接口地址、认证方式、请求格式'
                },
                {
                  key: 'no_api',
                  label: '没有 API 接口',
                  desc: '还没有，需要程序员新写一个',
                  icon: '🆕',
                  detail: '没关系，我会帮你生成需求文档给程序员'
                },
                {
                  key: 'has_db',
                  label: '有数据库，但没有接口',
                  desc: '可以直接往数据库里写数据',
                  icon: '🗄️',
                  detail: '需要数据库地址、表名、字段信息'
                },
                {
                  key: 'unknown',
                  label: '不确定',
                  desc: '需要问程序员',
                  icon: '❓',
                  detail: '我会告诉你怎么问程序员'
                },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => { setAnswers({ ...answers, hasApi: option.key }); setCurrentStep(3); }}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    answers.hasApi === option.key
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.desc}</p>
                    <p className="text-xs text-gray-400 mt-1">{option.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-gray-600">你的 ERP 部署在哪里？</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { key: 'cloud', label: '云服务器', desc: '阿里云/腾讯云/AWS/华为云', icon: '☁️' },
                { key: 'local', label: '本地服务器', desc: '公司自己的服务器/电脑', icon: '🖥️' },
                { key: 'saas', label: 'SaaS 平台', desc: '用的别人的云服务', icon: '🌐' },
                { key: 'unknown', label: '不清楚', desc: '不知道部署在哪', icon: '❓' },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => { setAnswers({ ...answers, deployment: option.key }); setCurrentStep(4); }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    answers.deployment === option.key
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return renderSolution();

      default:
        return null;
    }
  };

  const renderSolution = () => {
    const { erpType, techStack, hasApi, deployment } = answers;

    // 生成方案
    let solutionTitle = '';
    let solutionDesc = '';
    let solutionSteps: string[] = [];
    let codeExample = '';
    let needFromDev: string[] = [];

    if (hasApi === 'has_api') {
      solutionTitle = '✅ 直接对接方案';
      solutionDesc = '你的 ERP 已经有 API 接口，直接配置即可！';
      solutionSteps = [
        '1. 在工具的「ERP 对接」页面点击「添加 ERP」',
        '2. 选择「通用 API」模板',
        '3. 填入你的 API 接口地址',
        '4. 配置认证方式（Token/Key）',
        '5. 调整请求体模板匹配你的字段名',
        '6. 点击「测试连接」确认能通',
        '7. 开启「自动推送」',
      ];
      needFromDev = [
        'API 接口地址（URL）',
        '认证方式（Token / Key / 无认证）',
        '接口文档或请求格式示例',
      ];
      codeExample = `// 你的 ERP 需要接收的数据格式
POST /api/products/collect
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "url": "https://shopee.sg/product/xxx",
  "platform": "shopee",
  "itemId": "123456",
  "shopId": "789",
  "title": "商品标题",
  "price": "99.00",
  "skuId": "001",
  "collectedAt": "2025-01-01T00:00:00.000Z"
}`;
    } else if (hasApi === 'no_api') {
      solutionTitle = '🆕 需要新写接口';
      solutionDesc = '需要让你的程序员写一个接收接口，我帮你生成了需求文档。';
      solutionSteps = [
        '1. 把下面的「需求文档」发给你的程序员',
        '2. 让他按文档写一个接收接口',
        '3. 接口写好后，在工具里配置接口地址',
        '4. 测试连接 → 开启自动推送',
      ];
      needFromDev = [
        '新写的 API 接口地址',
        '认证方式',
      ];

      const techMap: Record<string, string> = {
        java: `// Java Spring Boot 示例代码
@RestController
@RequestMapping("/api/products")
public class ProductController {
    
    @PostMapping("/collect")
    public Result collectProduct(@RequestBody ProductDTO dto) {
        // 保存商品数据到数据库
        productService.saveFromCollector(dto);
        return Result.success();
    }
}

// DTO 类
public class ProductDTO {
    private String url;        // 商品链接
    private String platform;   // shopee/lazada
    private String itemId;     // 商品ID
    private String shopId;     // 店铺ID
    private String title;      // 标题
    private String price;      // 价格
    private String skuId;      // SKU ID
    private String collectedAt;// 采集时间
    // getter/setter...
}`,
        nodejs: `// Node.js Express 示例代码
app.post('/api/products/collect', async (req, res) => {
  const { url, platform, itemId, shopId, title, price, skuId, collectedAt } = req.body;
  
  // 保存到数据库
  await db.products.create({
    url, platform, itemId, shopId, title, price, skuId, collectedAt
  });
  
  res.json({ code: 0, message: 'success' });
});`,
        python: `# Python Flask 示例代码
@app.route('/api/products/collect', methods=['POST'])
def collect_product():
    data = request.get_json()
    
    # 保存到数据库
    product = Product(
        url=data['url'],
        platform=data['platform'],
        item_id=data['itemId'],
        shop_id=data['shopId'],
        title=data['title'],
        price=data['price'],
        sku_id=data['skuId'],
        collected_at=data['collectedAt']
    )
    db.session.add(product)
    db.session.commit()
    
    return jsonify(code=0, message='success')`,
        php: `// PHP Laravel 示例代码
Route::post('/api/products/collect', function (Request $request) {
    Product::create([
        'url' => $request->url,
        'platform' => $request->platform,
        'item_id' => $request->itemId,
        'shop_id' => $request->shopId,
        'title' => $request->title,
        'price' => $request->price,
        'sku_id' => $request->skuId,
        'collected_at' => $request->collectedAt,
    ]);
    
    return response()->json(['code' => 0, 'message' => 'success']);
});`,
      };
      codeExample = techMap[techStack || 'nodejs'] || techMap['nodejs'];
    } else if (hasApi === 'has_db') {
      solutionTitle = '🗄️ 数据库直连方案';
      solutionDesc = '可以直接往数据库写数据，但建议还是通过 API 接口更安全。';
      solutionSteps = [
        '1. 建议还是让程序员写一个 API 接口（更安全）',
        '2. 或者用中间件转发数据到数据库',
        '3. 配置数据库连接信息',
      ];
      needFromDev = [
        '数据库类型（MySQL/PostgreSQL/...）',
        '数据库地址',
        '商品表的表名和字段',
      ];
      codeExample = `-- 建议创建的商品表结构
CREATE TABLE collected_products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(500) NOT NULL COMMENT '商品链接',
    platform VARCHAR(20) NOT NULL COMMENT '平台: shopee/lazada',
    item_id VARCHAR(50) COMMENT '商品ID',
    shop_id VARCHAR(50) COMMENT '店铺ID',
    title VARCHAR(200) COMMENT '商品标题',
    price VARCHAR(20) COMMENT '价格',
    sku_id VARCHAR(50) COMMENT 'SKU ID',
    collected_at DATETIME COMMENT '采集时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_platform (platform),
    INDEX idx_item_id (item_id)
);`;
    } else {
      solutionTitle = '❓ 需要先确认信息';
      solutionDesc = '请先问你的程序员以下问题，然后回来继续配置。';
      solutionSteps = [
        '1. 问程序员：ERP 有没有 API 接口？',
        '2. 问程序员：接口地址是什么？',
        '3. 问程序员：需要什么认证方式？',
        '4. 拿到信息后回来配置',
      ];
      needFromDev = [
        'ERP 有没有现成的 API 接口？',
        '如果有，接口地址是什么？',
        '认证方式是什么（Token/Key/无）？',
        '接口文档或示例',
      ];
      codeExample = `// 问程序员这几个问题：
1. 我们的 ERP 有 API 接口吗？
2. 如果有，接口地址（URL）是什么？
3. 调用接口需要什么认证？（Token？Key？）
4. 有没有接口文档？

// 然后让他写一个接收接口：
POST /api/products/collect
接收 JSON 格式的商品数据，字段包括：
- url: 商品链接
- platform: 平台(shopee/lazada)
- itemId: 商品ID
- shopId: 店铺ID
- title: 标题
- price: 价格
- skuId: SKU ID
- collectedAt: 采集时间`;
    }

    return (
      <div className="space-y-4">
        {/* Solution Summary */}
        <div className={`bg-gradient-to-r ${steps[4].color} rounded-xl p-5 text-white`}>
          <h3 className="text-xl font-bold mb-1">{solutionTitle}</h3>
          <p className="text-white/90 text-sm">{solutionDesc}</p>
        </div>

        {/* Your Info Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">你选择的信息：</p>
          <div className="flex flex-wrap gap-2">
            {erpType && <span className="px-2 py-1 bg-white rounded text-xs border">ERP类型: {erpType === 'commercial' ? '买的现成ERP' : erpType === 'self_built' ? '自己开发' : erpType === 'outsourced' ? '外包开发' : '不清楚'}</span>}
            {techStack && <span className="px-2 py-1 bg-white rounded text-xs border">技术栈: {techStack}</span>}
            {hasApi && <span className="px-2 py-1 bg-white rounded text-xs border">API: {hasApi === 'has_api' ? '有接口' : hasApi === 'no_api' ? '没有接口' : hasApi === 'has_db' ? '有数据库' : '不确定'}</span>}
            {deployment && <span className="px-2 py-1 bg-white rounded text-xs border">部署: {deployment === 'cloud' ? '云服务器' : deployment === 'local' ? '本地服务器' : deployment === 'saas' ? 'SaaS平台' : '不清楚'}</span>}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl border p-4">
          <h4 className="font-medium text-gray-800 text-sm mb-3">📋 操作步骤</h4>
          <div className="space-y-2">
            {solutionSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Need from Developer */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h4 className="font-medium text-amber-800 text-sm mb-2 flex items-center gap-2">
            <HelpCircle size={16} />
            需要找你的程序员要这些信息：
          </h4>
          <ul className="space-y-1">
            {needFromDev.map((item, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={() => copyText(needFromDev.join('\n'), 'needFromDev')}
            className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-300"
          >
            {copied === 'needFromDev' ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copied === 'needFromDev' ? '已复制' : '复制发给程序员'}
          </button>
        </div>

        {/* Code Example */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 text-sm flex items-center gap-2">
              <Terminal size={14} />
              {hasApi === 'has_db' ? '建议的数据库表结构' : '代码示例'}
            </h4>
            <button
              onClick={() => copyText(codeExample, 'code')}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200"
            >
              {copied === 'code' ? <CheckCircle size={12} /> : <Copy size={12} />}
              {copied === 'code' ? '已复制' : '复制代码'}
            </button>
          </div>
          <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs text-gray-300 font-mono max-h-64 overflow-y-auto">
            {codeExample}
          </pre>
        </div>

        {/* Chat Message Template */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h4 className="font-medium text-blue-800 text-sm mb-2 flex items-center gap-2">
            <MessageCircle size={16} />
            发给程序员的消息模板（直接复制）：
          </h4>
          <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-blue-100">
            {`你好，我这边有个需求：

我在用一个链接采集工具，采集 Shopee/Lazada 的商品链接后，需要自动推送到我们的 ERP 系统。

需要你帮忙写一个接收接口：
- 接口方式：POST
- 数据格式：JSON
- 接收字段：url(商品链接)、platform(平台)、itemId(商品ID)、shopId(店铺ID)、title(标题)、price(价格)、skuId(SKU)、collectedAt(采集时间)

接口写好后把地址和认证方式告诉我就行，我这边配置一下就能自动推送了。

谢谢！`}
          </div>
          <button
            onClick={() => copyText(`你好，我这边有个需求：\n\n我在用一个链接采集工具，采集 Shopee/Lazada 的商品链接后，需要自动推送到我们的 ERP 系统。\n\n需要你帮忙写一个接收接口：\n- 接口方式：POST\n- 数据格式：JSON\n- 接收字段：url(商品链接)、platform(平台)、itemId(商品ID)、shopId(店铺ID)、title(标题)、price(价格)、skuId(SKU)、collectedAt(采集时间)\n\n接口写好后把地址和认证方式告诉我就行，我这边配置一下就能自动推送了。\n\n谢谢！`, 'msg')}
            className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-blue-200 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-300"
          >
            {copied === 'msg' ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copied === 'msg' ? '已复制' : '复制消息'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
              i < currentStep
                ? 'bg-green-500 text-white'
                : i === currentStep
                ? `bg-gradient-to-r ${step.color} text-white shadow-lg`
                : 'bg-gray-100 text-gray-400'
            }`}>
              {i < currentStep ? <CheckCircle size={16} /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 md:w-16 h-0.5 mx-1 ${
                i < currentStep ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Title */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${steps[currentStep].color} flex items-center justify-center text-white`}>
          {steps[currentStep].icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-800">
          {steps[currentStep].title}
        </h3>
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {renderStep()}
      </div>

      {/* Navigation */}
      {currentStep > 0 && currentStep < 4 && (
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentStep((currentStep - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
          >
            <ArrowLeft size={16} />
            上一步
          </button>
        </div>
      )}

      {currentStep === 4 && (
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentStep(0)}
            className="flex items-center gap-1 px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
          >
            <ArrowLeft size={16} />
            重新开始
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className="flex items-center gap-1 px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
          >
            <ArrowLeft size={16} />
            修改信息
          </button>
        </div>
      )}
    </div>
  );
}
