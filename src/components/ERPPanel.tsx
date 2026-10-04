import { useState, useEffect, useRef } from 'react';
import {
  Settings, Plus, Trash2, Save, TestTube, Zap, Globe, Key, FileCode,
  ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Server,
  Clipboard, BookOpen, Activity, ArrowRight, RefreshCw, Eye, EyeOff,
  Copy, ExternalLink, Info, Terminal
} from 'lucide-react';
import {
  ERPConfig, erpPresets, defaultFieldMapping, saveERPConfig, getERPConfigs, deleteERPConfig, pushToERP
} from '../utils/erpConnector';

interface ERPPanelProps {
  onTestResult?: (success: boolean, message: string) => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  configName: string;
  url: string;
  method: string;
  requestBody: string;
  response: string;
  status: number | null;
  success: boolean;
  duration: number;
}

export default function ERPPanel({ onTestResult }: ERPPanelProps) {
  const [configs, setConfigs] = useState<ERPConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ERPConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: any } | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('body');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfigs(getERPConfigs());
    // Load logs
    try {
      const savedLogs = localStorage.getItem('erp_logs');
      if (savedLogs) setLogs(JSON.parse(savedLogs));
    } catch {}
  }, []);

  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 100); // Keep last 100
    setLogs(updated);
    localStorage.setItem('erp_logs', JSON.stringify(updated));
  };

  const createNewConfig = (presetKey?: string) => {
    const preset = presetKey ? erpPresets[presetKey] : erpPresets['generic'];
    const newConfig: ERPConfig = {
      id: Date.now().toString(),
      name: preset.name || '新 ERP 配置',
      type: preset.type || 'api',
      apiUrl: '',
      authType: preset.authType || 'none',
      method: preset.method || 'POST',
      headers: {},
      bodyTemplate: preset.bodyTemplate || JSON.stringify({ url: '{{url}}', platform: '{{platform}}' }, null, 2),
      fieldMapping: defaultFieldMapping,
      autoPush: false,
      enabled: true,
    };
    setEditingConfig(newConfig);
    setShowForm(true);
    setTestResult(null);
  };

  const handleSave = () => {
    if (!editingConfig) return;
    if (!editingConfig.apiUrl) {
      setTestResult({ success: false, message: '请填写 API 地址' });
      return;
    }
    saveERPConfig(editingConfig);
    setConfigs(getERPConfigs());
    setShowForm(false);
    setEditingConfig(null);
    setTestResult(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除此 ERP 配置？')) {
      deleteERPConfig(id);
      setConfigs(getERPConfigs());
    }
  };

  const handleTest = async () => {
    if (!editingConfig) return;
    setTesting(true);
    setTestResult(null);

    const testData = {
      url: 'https://shopee.sg/test-product-i.123456.789012',
      platform: 'shopee',
      itemId: '123456',
      shopId: '789012',
      title: '测试商品 - Test Product',
      price: '99.00',
      skuId: '001',
      collectedAt: new Date().toISOString(),
    };

    const startTime = Date.now();
    const result = await pushToERP(editingConfig, testData);
    const duration = Date.now() - startTime;

    setTestResult({ success: result.success, message: result.message, response: result.response });
    setTesting(false);
    onTestResult?.(result.success, result.message);

    addLog({
      configName: editingConfig.name,
      url: editingConfig.apiUrl,
      method: editingConfig.method,
      requestBody: result.message,
      response: JSON.stringify(result.response || '', null, 2),
      status: result.success ? 200 : 400,
      success: result.success,
      duration,
    });
  };

  const toggleAutoPush = (id: string) => {
    const config = configs.find(c => c.id === id);
    if (config) {
      const updated = { ...config, autoPush: !config.autoPush };
      saveERPConfig(updated);
      setConfigs(getERPConfigs());
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generateDoc = () => {
    return `# ERP 对接接口文档

## 概述
本工具会自动将采集到的 Shopee/Lazada 商品链接推送到你的 ERP 系统。

## 请求信息
- **请求方式**: POST
- **Content-Type**: application/json
- **请求地址**: 由用户在工具中配置

## 请求体格式 (默认)
\`\`\`json
{
  "url": "商品完整链接",
  "platform": "shopee | lazada",
  "itemId": "商品ID",
  "shopId": "店铺ID",
  "title": "商品标题",
  "price": "价格",
  "skuId": "SKU ID",
  "collectedAt": "采集时间 ISO8601"
}
\`\`\`

## 示例请求
\`\`\`bash
curl -X POST https://your-erp.com/api/products \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "url": "https://shopee.sg/product/xxx",
    "platform": "shopee",
    "itemId": "123456",
    "shopId": "789",
    "title": "商品名称",
    "price": "99.00",
    "skuId": "001",
    "collectedAt": "2025-01-01T00:00:00.000Z"
  }'
\`\`\`

## 期望响应
\`\`\`json
{
  "code": 0,
  "message": "success",
   {
    "id": "erp_product_id"
  }
}
\`\`\`

## 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 商品完整链接 |
| platform | string | 平台：shopee / lazada |
| itemId | string | 商品ID |
| shopId | string | 店铺ID |
| title | string | 商品标题 |
| price | string | 商品价格 |
| skuId | string | SKU ID |
| collectedAt | string | 采集时间 (ISO8601) |

## 注意事项
1. 工具支持自定义请求体模板，字段名可以映射
2. 支持 Bearer Token / Basic Auth / API Key 等认证方式
3. 推送失败时会自动记录日志，可在工具中查看
`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Server className="text-purple-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">ERP 对接配置</h3>
          {configs.filter(c => c.autoPush).length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs animate-pulse">
              <Zap size={12} />
              自动推送已开启
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDoc(!showDoc)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
          >
            <BookOpen size={14} />
            对接文档
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
          >
            <Activity size={14} />
            请求日志 ({logs.length})
          </button>
          {!showForm && (
            <button
              onClick={() => createNewConfig()}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all"
            >
              <Plus size={14} />
              添加 ERP
            </button>
          )}
        </div>
      </div>

      {/* API Documentation */}
      {showDoc && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen size={16} className="text-purple-600" />
              ERP 对接接口文档
            </h4>
            <button
              onClick={() => copyToClipboard(generateDoc(), 'doc')}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200"
            >
              {copiedField === 'doc' ? <CheckCircle size={12} /> : <Copy size={12} />}
              {copiedField === 'doc' ? '已复制' : '复制文档'}
            </button>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {generateDoc()}
            </pre>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            💡 把这份文档发给你的 ERP 开发人员，让他按这个格式写接收接口就行。
          </p>
        </div>
      )}

      {/* API Logs */}
      {showLogs && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <Terminal size={16} className="text-purple-600" />
              请求日志
            </h4>
            <button
              onClick={() => { setLogs([]); localStorage.removeItem('erp_logs'); }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              清空日志
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无日志记录</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className={`p-3 rounded-lg border text-xs ${
                  log.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{log.configName}</span>
                    <span className="text-gray-400">{new Date(log.timestamp).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded ${log.success ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                      {log.status || 'ERR'}
                    </span>
                    <span>{log.method} {log.url.substring(0, 40)}...</span>
                    <span>{log.duration}ms</span>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Preset Quick Add */}
      {!showForm && configs.length === 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-5">
          <p className="text-sm text-gray-600 mb-3">
            <strong>自建 ERP？</strong> 选择「通用 API」或「Webhook」模板，然后填入你的接口地址即可。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(erpPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => createNewConfig(key)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Config List */}
      {configs.length > 0 && !showForm && (
        <div className="space-y-2">
          {configs.map(config => (
            <div key={config.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    config.enabled ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {config.enabled ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-gray-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{config.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[300px]">{config.apiUrl || '未配置地址'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAutoPush(config.id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      config.autoPush
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {config.autoPush ? '⚡ 自动推送 ON' : '自动推送 OFF'}
                  </button>
                  <button
                    onClick={() => { setEditingConfig(config); setShowForm(true); }}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Form */}
      {showForm && editingConfig && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 animate-fade-in">
          <h4 className="font-semibold text-gray-800">
            {configs.find(c => c.id === editingConfig.id) ? '编辑配置' : '新建 ERP 配置'}
          </h4>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">配置名称</label>
              <input
                type="text"
                value={editingConfig.name}
                onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
                placeholder="例如：我的ERP"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">请求方式</label>
              <select
                value={editingConfig.method}
                onChange={(e) => setEditingConfig({ ...editingConfig, method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
          </div>

          {/* API URL */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Globe size={12} /> API 接口地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={editingConfig.apiUrl}
              onChange={(e) => setEditingConfig({ ...editingConfig, apiUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none font-mono"
              placeholder="https://your-erp.com/api/products/collect"
            />
            <p className="text-xs text-gray-400 mt-1">你的 ERP 接收商品链接的接口地址</p>
          </div>

          {/* Auth */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Key size={12} /> 认证方式
              </label>
              <select
                value={editingConfig.authType}
                onChange={(e) => setEditingConfig({ ...editingConfig, authType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
              >
                <option value="none">无认证</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth (用户名/密码)</option>
                <option value="apikey">API Key (Header)</option>
                <option value="custom">自定义 (在请求体中传递)</option>
              </select>
            </div>

            {(editingConfig.authType === 'bearer' || editingConfig.authType === 'apikey') && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {editingConfig.authType === 'bearer' ? 'Bearer Token' : 'API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={editingConfig.authToken || editingConfig.apiKey || ''}
                    onChange={(e) => setEditingConfig({
                      ...editingConfig,
                      authToken: e.target.value,
                      apiKey: e.target.value,
                    })}
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none font-mono"
                    placeholder="输入 Token 或 Key"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {editingConfig.authType === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">用户名 / AppKey</label>
                  <input
                    type="text"
                    value={editingConfig.apiKey || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
                    placeholder="AppKey"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">密码 / AppSecret</label>
                  <input
                    type="password"
                    value={editingConfig.apiSecret || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, apiSecret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
                    placeholder="AppSecret"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Body Template */}
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'body' ? null : 'body')}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 hover:text-purple-600"
            >
              <FileCode size={12} />
              请求体模板 (JSON)
              {expandedSection === 'body' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'body' && (
              <div>
                <textarea
                  value={editingConfig.bodyTemplate}
                  onChange={(e) => setEditingConfig({ ...editingConfig, bodyTemplate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none h-48 resize-none"
                  placeholder='{"url": "{{url}}", "platform": "{{platform}}"}'
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-gray-400">可用变量：</span>
                  {['url', 'platform', 'itemId', 'shopId', 'title', 'price', 'skuId', 'collectedAt'].map(v => (
                    <button
                      key={v}
                      onClick={() => copyToClipboard(`{{${v}}}`, v)}
                      className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs font-mono hover:bg-purple-100"
                    >
                      {copiedField === v ? '✓' : `{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Field Mapping Preview */}
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'mapping' ? null : 'mapping')}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 hover:text-purple-600"
            >
              <ArrowRight size={12} />
              字段映射预览
              {expandedSection === 'mapping' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'mapping' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">采集到的数据会按以下格式发送到你的 ERP：</p>
                <pre className="text-xs font-mono text-gray-700 bg-white p-3 rounded border border-gray-200 overflow-x-auto">
{JSON.stringify({
  [editingConfig.fieldMapping.url]: "https://shopee.sg/product/xxx",
  [editingConfig.fieldMapping.platform]: "shopee",
  [editingConfig.fieldMapping.itemId]: "123456",
  [editingConfig.fieldMapping.shopId]: "789",
  [editingConfig.fieldMapping.title]: "商品标题",
  [editingConfig.fieldMapping.price]: "99.00",
  [editingConfig.fieldMapping.skuId]: "001",
}, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.success ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.response && (
                  <pre className="text-xs mt-1 opacity-70 overflow-x-auto">
                    {typeof testResult.response === 'string' ? testResult.response : JSON.stringify(testResult.response, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all"
            >
              <Save size={14} />
              保存配置
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !editingConfig.apiUrl}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              <TestTube size={14} />
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingConfig(null); setTestResult(null); }}
              className="px-4 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Quick Setup Guide for Self-built ERP */}
      {!showForm && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5">
          <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Info size={14} className="text-indigo-500" />
            自建 ERP 快速对接指南
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <p className="text-xs font-medium text-indigo-600 mb-1">Step 1: 写接收接口</p>
              <p className="text-xs text-gray-500">在你的 ERP 后端写一个 POST 接口，接收 JSON 格式的商品数据</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <p className="text-xs font-medium text-indigo-600 mb-1">Step 2: 配置本工具</p>
              <p className="text-xs text-gray-500">填入接口地址和认证信息，调整请求体模板匹配你的字段名</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <p className="text-xs font-medium text-indigo-600 mb-1">Step 3: 开启自动推送</p>
              <p className="text-xs text-gray-500">开启后，每次采集链接会自动发送到你的 ERP，无需手动操作</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            💡 点击上方的「对接文档」按钮，复制文档发给你的开发人员参考。
          </p>
        </div>
      )}
    </div>
  );
}
