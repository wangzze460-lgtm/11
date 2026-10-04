import { useState, useCallback, useEffect } from 'react';
import { Link, Download, Code, Trash2, Copy, ExternalLink, FileSpreadsheet, Search, ShoppingBag, CheckCircle, AlertCircle, Server, Zap, Eye } from 'lucide-react';
import { parseProductUrl, exportToCSV, ProductInfo } from './utils/linkParser';
import { extensionFiles } from './utils/extensionCode';
import { getERPConfigs, pushToERP } from './utils/erpConnector';
import ERPPanel from './components/ERPPanel';
import ERPWizard from './components/ERPWizard';
import DoubaoERPGuide from './components/DoubaoERPGuide';
import ProductDetail from './components/ProductDetail';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type TabType = 'collector' | 'results' | 'extension' | 'erp' | 'import';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('collector');
  const [inputUrl, setInputUrl] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [importData, setImportData] = useState('');
  const [collectedLinks, setCollectedLinks] = useState<ProductInfo[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');
  const [erpAutoPush, setErpAutoPush] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);

  useEffect(() => {
    const configs = getERPConfigs();
    setErpAutoPush(configs.some(c => c.autoPush && c.enabled));
  }, [activeTab]);

  // 自动推送到 ERP
  const autoPushToERP = useCallback(async (products: ProductInfo[]) => {
    const configs = getERPConfigs().filter(c => c.autoPush && c.enabled);
    if (configs.length === 0) return;

    for (const product of products) {
      const data = {
        url: product.url,
        platform: product.platform,
        itemId: product.itemId || '',
        shopId: product.shopId || '',
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        originalPrice: product.originalPrice || '',
        skuId: product.skuId || '',
        shopName: product.shopName || '',
        rating: product.rating?.toString() || '',
        soldCount: product.soldCount?.toString() || '',
        images: product.images ? JSON.stringify(product.images) : '[]',
        specifications: product.specifications ? JSON.stringify(product.specifications) : '{}',
        variants: product.variants ? JSON.stringify(product.variants) : '[]',
        collectedAt: product.collectedAt,
      };

      for (const config of configs) {
        await pushToERP(config, data);
      }
    }
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCollectSingle = useCallback(() => {
    if (!inputUrl.trim()) {
      showNotification('error', '请输入链接');
      return;
    }

    const urls = inputUrl.split('\n').filter(u => u.trim());
    const newLinks: ProductInfo[] = [];

    for (const url of urls) {
      try {
        const product = parseProductUrl(url.trim());
        if (product.platform === 'unknown') {
          showNotification('error', `无法识别的链接: ${url.substring(0, 50)}...`);
          continue;
        }
        newLinks.push(product);
      } catch {
        showNotification('error', `解析失败: ${url.substring(0, 50)}...`);
      }
    }

    if (newLinks.length > 0) {
      setCollectedLinks(prev => [...newLinks, ...prev]);
      setInputUrl('');
      showNotification('success', `成功采集 ${newLinks.length} 个链接${erpAutoPush ? '（已自动推送到ERP）' : ''}`);
      // 自动推送到 ERP
      if (erpAutoPush) {
        autoPushToERP(newLinks);
      }
    }
  }, [inputUrl, erpAutoPush, autoPushToERP]);

  const handleCollectBulk = useCallback(() => {
    if (!bulkInput.trim()) {
      showNotification('error', '请输入链接');
      return;
    }

    const urls = bulkInput.split(/[\n,;]+/).filter(u => u.trim());
    const newLinks: ProductInfo[] = [];
    let errorCount = 0;

    for (const url of urls) {
      try {
        const product = parseProductUrl(url.trim());
        if (product.platform === 'unknown') {
          errorCount++;
          continue;
        }
        newLinks.push(product);
      } catch {
        errorCount++;
      }
    }

    if (newLinks.length > 0) {
      setCollectedLinks(prev => [...newLinks, ...prev]);
      setBulkInput('');
      showNotification('success', `成功采集 ${newLinks.length} 个链接${errorCount > 0 ? `，${errorCount} 个失败` : ''}${erpAutoPush ? '（已自动推送到ERP）' : ''}`);
      // 自动推送到 ERP
      if (erpAutoPush) {
        autoPushToERP(newLinks);
      }
    } else {
      showNotification('error', '没有成功采集任何链接');
    }
  }, [bulkInput, erpAutoPush, autoPushToERP]);

  // 从油猴脚本导入数据
  const handleImportFromTampermonkey = useCallback(() => {
    if (!importData.trim()) {
      showNotification('error', '请粘贴从油猴脚本导出的数据');
      return;
    }

    try {
      // 尝试解析 JSON
      const rawData = JSON.parse(importData);
      const products: ProductInfo[] = [];

      // 支持数组或单个对象
      const items = Array.isArray(rawData) ? rawData : [rawData];

      for (const item of items) {
        const product: ProductInfo = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          platform: item.platform || (item.url?.includes('shopee') ? 'shopee' : 'lazada'),
          url: item.url || '',
          title: item.title || '',
          description: item.description || '',
          price: item.price || '',
          originalPrice: item.originalPrice || '',
          shopName: item.shopName || '',
          itemId: item.itemId || '',
          shopId: item.shopId || '',
          skuId: item.skuId || '',
          images: item.images || [],
          specifications: item.specifications || {},
          variants: item.variants || [],
          rating: item.rating || 0,
          soldCount: item.soldCount || 0,
          collectedAt: item.collectedAt || new Date().toISOString(),
        };
        products.push(product);
      }

      if (products.length > 0) {
        setCollectedLinks(prev => [...products, ...prev]);
        setImportData('');
        showNotification('success', `✓ 成功导入 ${products.length} 个商品${erpAutoPush ? '（已自动推送到ERP）' : ''}`);
        
        // 自动推送到 ERP
        if (erpAutoPush) {
          autoPushToERP(products);
        }
      } else {
        showNotification('error', '没有解析到有效的商品数据');
      }
    } catch (error) {
      console.error('导入失败：', error);
      showNotification('error', '数据格式错误，请检查是否是有效的 JSON');
    }
  }, [importData, erpAutoPush, autoPushToERP]);

  const handleExport = useCallback(() => {
    if (collectedLinks.length === 0) {
      showNotification('error', '没有可导出的链接');
      return;
    }

    const csv = exportToCSV(collectedLinks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `采集链接_${new Date().toISOString().slice(0, 10)}.csv`);
    showNotification('success', '导出成功');
  }, [collectedLinks]);

  const handleClear = useCallback(() => {
    setCollectedLinks([]);
    showNotification('success', '已清空所有链接');
  }, []);

  const handleDeleteLink = useCallback((id: string) => {
    setCollectedLinks(prev => prev.filter(l => l.id !== id));
  }, []);

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    showNotification('success', '链接已复制');
  }, []);

  const handleDownloadExtension = async () => {
    try {
      const zip = new JSZip();
      
      // 添加所有扩展文件
      for (const [filename, content] of Object.entries(extensionFiles)) {
        zip.file(filename, content);
      }

      // 添加安装说明
      zip.file('安装说明.txt', `Shopee & Lazada 链接采集器 安装步骤
=====================================

1. 解压这个 ZIP 文件到任意文件夹

2. 打开 Chrome 浏览器，地址栏输入：chrome://extensions/

3. 开启右上角的「开发者模式」

4. 点击「加载已解压的扩展程序」

5. 选择解压后的文件夹

6. 完成！打开 Shopee 或 Lazada 网站即可使用

使用方法：
- 在商品页面点击右下角的橙色按钮即可采集
- 点击扩展图标可以查看和管理采集的链接
- 支持导出 CSV 文件

注意事项：
- 采集商品详情（包括图片）需要在商品详情页操作
- 列表页只能采集商品链接
- 采集的数据会自动保存到扩展存储中

如有问题，请联系开发者。`);

      const blob = await zip.generateAsync({ type: 'blob' });
      
      // 尝试直接下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shopee-lazada-link-collector.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('success', '✓ 扩展已下载！请查看浏览器下载栏或"下载"文件夹');
    } catch (error) {
      console.error('下载失败:', error);
      showNotification('error', '下载失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-slide-in ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-200">
                <Link className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Shopee & Lazada 链接采集工具</h1>
                <p className="text-xs text-gray-500">一键采集电商平台商品完整链接</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                已采集: {collectedLinks.length} 条
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('collector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'collector'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Search size={16} />
            在线采集
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'results'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileSpreadsheet size={16} />
            采集结果
            {collectedLinks.length > 0 && (
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {collectedLinks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('extension')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'extension'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Code size={16} />
            Chrome 扩展
          </button>
          <button
            onClick={() => setActiveTab('erp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'erp'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Server size={16} />
            ERP 对接
            {erpAutoPush && (
              <span className="flex items-center gap-0.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">
                <Zap size={10} />
                已连接
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'import'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Download size={16} />
            从油猴导入
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Collector Tab */}
        {activeTab === 'collector' && (
          <div className="space-y-6">
            {/* Input Mode Toggle */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">链接采集</h2>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setInputMode('single')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      inputMode === 'single' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'
                    }`}
                  >
                    单条采集
                  </button>
                  <button
                    onClick={() => setInputMode('bulk')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      inputMode === 'bulk' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'
                    }`}
                  >
                    批量采集
                  </button>
                </div>
              </div>

              {inputMode === 'single' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCollectSingle()}
                      placeholder="粘贴 Shopee 或 Lazada 商品链接..."
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm"
                    />
                    <Link className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  </div>
                  <button
                    onClick={handleCollectSingle}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={18} />
                    采集链接
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={"批量粘贴链接，每行一个或用逗号分隔...\n\n例如:\nhttps://shopee.sg/product/123/456\nhttps://www.lazada.sg/products/item-i123456.html"}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm h-40 resize-none"
                  />
                  <button
                    onClick={handleCollectBulk}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={18} />
                    批量采集
                  </button>
                </div>
              )}

              {/* Supported platforms info */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">支持平台:</span>
                {['shopee.sg', 'shopee.com.my', 'shopee.co.th', 'shopee.vn', 'shopee.ph', 'shopee.id', 'shopee.tw', 'shopee.br', 'lazada.sg', 'lazada.com.my', 'lazada.co.th', 'lazada.com.ph', 'lazada.vn', 'lazada.co.id'].map(site => (
                  <span key={site} className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">
                    {site}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <span className="text-lg">🟠</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {collectedLinks.filter(l => l.platform === 'shopee').length}
                    </p>
                    <p className="text-xs text-gray-500">Shopee 链接</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-lg">🔵</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {collectedLinks.filter(l => l.platform === 'lazada').length}
                    </p>
                    <p className="text-xs text-gray-500">Lazada 链接</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileSpreadsheet className="text-green-600" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{collectedLinks.length}</p>
                    <p className="text-xs text-gray-500">总计采集</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Tips */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border border-orange-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                💡 使用提示
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  复制 Shopee/Lazada 商品页面的完整链接粘贴到输入框即可采集
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  支持批量采集：切换到"批量采集"模式，每行粘贴一个链接
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  推荐使用 Chrome 扩展实现页面内一键采集，更方便高效
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  采集结果支持导出为 CSV 文件，可直接用 Excel 打开
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {/* Actions Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  采集结果 ({collectedLinks.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={collectedLinks.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    导出 CSV
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={collectedLinks.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    清空
                  </button>
                </div>
              </div>
            </div>

            {/* Results Table */}
            {collectedLinks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Search className="text-gray-400" size={28} />
                </div>
                <p className="text-gray-500 font-medium">暂无采集结果</p>
                <p className="text-gray-400 text-sm mt-1">前往"在线采集"页面添加链接</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">平台</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">商品ID</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">标题</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">链接</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">采集时间</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {collectedLinks.map((link) => (
                        <tr key={link.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              link.platform === 'shopee' 
                                ? 'bg-orange-100 text-orange-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {link.platform === 'shopee' ? '🟠' : '🔵'}
                              {link.platform === 'shopee' ? 'Shopee' : 'Lazada'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600 font-mono">{link.itemId || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-800 max-w-[200px] truncate block">
                              {link.title || '无标题'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500 max-w-[200px] truncate block" title={link.url}>
                              {link.url}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {new Date(link.collectedAt).toLocaleString('zh-CN')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSelectedProduct(link)}
                                className="p-1.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all"
                                title="查看详情"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleCopyUrl(link.url)}
                                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
                                title="复制链接"
                              >
                                <Copy size={14} />
                              </button>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
                                title="打开链接"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => handleDeleteLink(link.id)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-all"
                                title="删除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extension Tab */}
        {activeTab === 'extension' && (
          <div className="space-y-6">
            {/* Extension Intro */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">Chrome 浏览器扩展</h2>
                  <p className="text-gray-600 text-sm max-w-lg">
                    安装 Chrome 扩展后，在浏览 Shopee 或 Lazada 时，页面右下角会出现采集按钮，
                    点击即可一键采集当前页面的所有商品链接。
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadExtension}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-200"
                  >
                    <Download size={18} />
                    下载扩展 (ZIP)
                  </button>
                </div>
              </div>
            </div>

            {/* 手动安装指南 - 不需要下载 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">💡</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">找不到下载文件？用这个方法！</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    如果下载的文件找不到，可以直接复制下面的代码，手动创建文件。
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-gray-800 text-sm">手动安装步骤：</h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="font-bold text-green-600">1.</span>
                    <span>在桌面新建一个文件夹，命名为 <code className="bg-gray-100 px-2 py-0.5 rounded">shopee-extension</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-green-600">2.</span>
                    <span>打开这个文件夹，点击下面的"复制所有文件"按钮</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-green-600">3.</span>
                    <span>在 Chrome 地址栏输入 <code className="bg-gray-100 px-2 py-0.5 rounded">chrome://extensions/</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-green-600">4.</span>
                    <span>开启右上角"开发者模式"，点击"加载已解压的扩展程序"，选择你创建的文件夹</span>
                  </li>
                </ol>

                <button
                  onClick={() => {
                    const allFiles = Object.entries(extensionFiles)
                      .map(([filename, content]) => `===== ${filename} =====\n${content}\n`)
                      .join('\n');
                    navigator.clipboard.writeText(allFiles);
                    showNotification('success', '✓ 所有文件已复制！请按照步骤创建文件');
                  }}
                  className="w-full mt-3 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={18} />
                  复制所有文件内容
                </button>
                <p className="text-xs text-gray-500 text-center">
                  复制后，在文件夹里为每个文件创建对应的文件，粘贴内容保存即可
                </p>
              </div>
            </div>

            {/* Installation Guide */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📦 安装步骤</h3>
              <div className="space-y-4">
                {[
                  { step: 1, title: '下载扩展', desc: '点击上方"下载扩展"按钮，获取 ZIP 压缩包' },
                  { step: 2, title: '解压文件', desc: '将下载的 ZIP 文件解压到一个文件夹中' },
                  { step: 3, title: '打开扩展管理', desc: '在 Chrome 地址栏输入 chrome://extensions/ 并回车' },
                  { step: 4, title: '开启开发者模式', desc: '在扩展管理页面右上角开启"开发者模式"' },
                  { step: 5, title: '加载扩展', desc: '点击"加载已解压的扩展程序"，选择解压后的文件夹' },
                  { step: 6, title: '开始使用', desc: '打开 Shopee 或 Lazada 网站，点击页面右下角的采集按钮即可' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">⚡</span> 核心功能
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    一键采集当前页面商品链接
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    批量采集列表页所有商品
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    自动提取商品ID、店铺ID等信息
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    导出CSV文件
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    支持所有Shopee/Lazada站点
                  </li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">🌐</span> 支持站点
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-orange-600 mb-1">Shopee</p>
                    <div className="flex flex-wrap gap-1">
                      {['SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'TW', 'BR'].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600 mb-1">Lazada</p>
                    <div className="flex flex-wrap gap-1">
                      {['SG', 'MY', 'TH', 'VN', 'PH', 'ID'].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📄 扩展文件（逐个复制）</h3>
              <p className="text-sm text-gray-600 mb-4">
                如果上面的"复制所有文件"不好用，可以逐个复制下面的文件内容。
                在你的文件夹里创建对应文件名的文件，粘贴内容保存即可。
              </p>
              <div className="space-y-3">
                {Object.entries(extensionFiles).map(([filename, content]) => (
                  <details key={filename} className="group">
                    <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Code size={14} />
                        {filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(content);
                            showNotification('success', `✓ ${filename} 已复制`);
                          }}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        >
                          复制
                        </button>
                        <span className="text-xs text-gray-400">{content.length} 字符</span>
                      </div>
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-900 rounded-lg overflow-x-auto text-xs text-gray-300 max-h-60 overflow-y-auto">
                      <code>{content}</code>
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ERP Tab */}
        {activeTab === 'erp' && (
          <div className="space-y-6">
            {/* ERP Intro Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">🔌 ERP 系统对接</h2>
                  <p className="text-purple-100 text-sm max-w-lg">
                    配置你的 ERP 系统后，采集到的商品链接将自动推送到你的 ERP。
                    支持马帮、通途、店小秘、万邑通等主流 ERP，也支持自定义 API 对接。
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <Zap size={16} />
                  <span className="text-sm font-medium">采集即推送，无需手动导入</span>
                </div>
              </div>
            </div>

            {/* ERP Wizard - 对接向导 */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    🧭 不知道怎么做？用对接向导
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    回答几个简单问题，我帮你生成完整的对接方案和代码，直接发给程序员就行
                  </p>
                </div>
              </div>
              <ERPWizard />
            </div>

            {/* 豆包 ERP 对接指南 */}
            <DoubaoERPGuide />

            {/* ERP Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <ERPPanel onTestResult={(success, message) => {
                showNotification(success ? 'success' : 'error', message);
              }} />
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            {/* Import Guide */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
              <h2 className="text-xl font-bold mb-2">📥 从油猴脚本导入数据</h2>
              <p className="text-green-100 text-sm">
                把油猴脚本采集的数据导入到这个系统，然后自动推送到你的 ERP
              </p>
            </div>

            {/* Step by Step Guide */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 操作步骤</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">在油猴脚本里导出数据</p>
                    <p className="text-sm text-gray-600 mt-1">
                      在 Lazada 页面按 F12 打开控制台，输入：<code className="bg-gray-100 px-2 py-0.5 rounded text-xs">viewProducts()</code>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      或者点击油猴图标 → 查看用户数据 → 复制 JSON 数据
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">复制 JSON 数据</p>
                    <p className="text-sm text-gray-600 mt-1">
                      复制控制台输出的 JSON 数据（整个数组）
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">粘贴到下面并导入</p>
                    <p className="text-sm text-gray-600 mt-1">
                      把 JSON 数据粘贴到输入框，点击"导入数据"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">自动推送到 ERP</p>
                    <p className="text-sm text-gray-600 mt-1">
                      如果已配置 ERP 并开启自动推送，数据会自动发送到你的 ERP
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Import Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📝 粘贴数据</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    JSON 数据（从油猴脚本导出）
                  </label>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder='粘贴 JSON 数据，例如：&#10;[&#10;  {&#10;    "url": "https://www.lazada.co.th/products/xxx",&#10;    "title": "商品标题",&#10;    "price": "99.00",&#10;    "images": ["https://..."],&#10;    "collectedAt": "2025-01-01T00:00:00.000Z"&#10;  }&#10;]'
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm h-48 resize-none font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleImportFromTampermonkey}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-200"
                  >
                    <Download size={18} />
                    导入数据
                  </button>
                  <button
                    onClick={() => setImportData('')}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                  >
                    清空
                  </button>
                </div>

                {erpAutoPush && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <Zap size={16} className="text-green-600" />
                    <span className="text-sm text-green-700">
                      已开启自动推送，导入后会自动发送到 ERP
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Export Script */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 油猴脚本导出代码</h3>
              <p className="text-sm text-gray-600 mb-3">
                如果你想让油猴脚本更方便地导出数据，可以更新脚本，添加导出按钮：
              </p>
              <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-xs text-gray-300 font-mono">
{`// 在油猴脚本里添加这个函数
window.exportProducts = function() {
    const products = JSON.parse(GM_getValue('lazada_products', '[]'));
    const json = JSON.stringify(products, null, 2);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(json).then(() => {
        alert('✓ 已复制 ' + products.length + ' 个商品数据到剪贴板\\n\\n请粘贴到导入页面');
    });
    
    console.log('导出的数据：', products);
    return products;
};

// 然后在控制台输入：exportProducts()
// 或者添加一个导出按钮`}
                </pre>
              </div>
              <button
                onClick={() => {
                  const code = `window.exportProducts = function() {
    const products = JSON.parse(GM_getValue('lazada_products', '[]'));
    const json = JSON.stringify(products, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        alert('✓ 已复制 ' + products.length + ' 个商品数据到剪贴板\\n\\n请粘贴到导入页面');
    });
    return products;
};`;
                  navigator.clipboard.writeText(code);
                  showNotification('success', '✓ 导出代码已复制，添加到油猴脚本里即可');
                }}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all"
              >
                <Copy size={16} />
                复制导出代码
              </button>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                💡 使用提示
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>导入的数据会显示在「采集结果」页面，可以查看详情、导出 CSV 或推送 ERP</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>支持导入单个商品或商品数组（JSON 格式）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>如果开启了 ERP 自动推送，导入后会自动发送数据到你的 ERP</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>数据保存在浏览器本地，刷新页面不会丢失</span>
                </li>
              </ul>
            </div>

            {/* Workflow Diagram */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 工作流程</h3>
              <div className="flex items-center justify-between flex-wrap gap-4">
                {[
                  { icon: '🌐', label: '浏览 Shopee/Lazada', color: 'bg-orange-50 border-orange-200' },
                  { icon: '🔗', label: '采集商品链接', color: 'bg-blue-50 border-blue-200' },
                  { icon: '⚡', label: '自动推送 ERP', color: 'bg-purple-50 border-purple-200' },
                  { icon: '✅', label: 'ERP 自动入库', color: 'bg-green-50 border-green-200' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${step.color}`}>
                      <span className="text-2xl">{step.icon}</span>
                      <span className="text-xs font-medium text-gray-700 text-center">{step.label}</span>
                    </div>
                    {i < 3 && (
                      <svg className="w-6 h-6 text-gray-300 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* How to get API info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🔑 如何获取 ERP API 信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-700 text-sm mb-2">马帮 ERP</p>
                  <p className="text-xs text-gray-500">登录马帮后台 → 系统设置 → API管理 → 获取 AppKey 和 AppSecret</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-700 text-sm mb-2">通途 ERP</p>
                  <p className="text-xs text-gray-500">登录通途后台 → 系统管理 → 开放平台 → 获取 API 密钥</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-700 text-sm mb-2">店小秘</p>
                  <p className="text-xs text-gray-500">登录店小秘后台 → 设置中心 → 开发者设置 → 获取 API Token</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-700 text-sm mb-2">自建 ERP / 其他</p>
                  <p className="text-xs text-gray-500">联系你的 ERP 开发人员，获取 API 文档和接口地址</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          Shopee & Lazada 链接采集工具 v1.0 | 仅供学习研究使用
        </p>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

export default App;
