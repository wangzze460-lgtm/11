import { useState, useEffect } from 'react';
import {
  Settings, Plus, Trash2, Save, TestTube, Zap, Globe, Key, FileCode,
  ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Server
} from 'lucide-react';
import {
  ERPConfig, erpPresets, defaultFieldMapping, saveERPConfig, getERPConfigs, deleteERPConfig, pushToERP
} from '../utils/erpConnector';

interface ERPPanelProps {
  onTestResult?: (success: boolean, message: string) => void;
}

export default function ERPPanel({ onTestResult }: ERPPanelProps) {
  const [configs, setConfigs] = useState<ERPConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ERPConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    setConfigs(getERPConfigs());
  }, []);

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

    const result = await pushToERP(editingConfig, testData);
    setTestResult({ success: result.success, message: result.message });
    setTesting(false);
    onTestResult?.(result.success, result.message);
  };

  const toggleAutoPush = (id: string) => {
    const config = configs.find(c => c.id === id);
    if (config) {
      const updated = { ...config, autoPush: !config.autoPush };
      saveERPConfig(updated);
      setConfigs(getERPConfigs());
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="text-purple-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">ERP 对接配置</h3>
          {configs.filter(c => c.autoPush).length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
              <Zap size={12} />
              自动推送已开启
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => createNewConfig()}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all"
          >
            <Plus size={16} />
            添加 ERP
          </button>
        )}
      </div>

      {/* Preset Quick Add */}
      {!showForm && configs.length === 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-5">
          <p className="text-sm text-gray-600 mb-3">快速选择你的 ERP 系统：</p>
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
                    {config.autoPush ? '自动推送 ON' : '自动推送 OFF'}
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
                placeholder="例如：我的马帮ERP"
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
              <Globe size={12} /> API 地址
            </label>
            <input
              type="url"
              value={editingConfig.apiUrl}
              onChange={(e) => setEditingConfig({ ...editingConfig, apiUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none font-mono"
              placeholder="https://api.your-erp.com/v1/products"
            />
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
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            {(editingConfig.authType === 'bearer' || editingConfig.authType === 'apikey') && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Token / API Key</label>
                <input
                  type="password"
                  value={editingConfig.authToken || editingConfig.apiKey || ''}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    authToken: e.target.value,
                    apiKey: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none font-mono"
                  placeholder="输入你的 Token 或 API Key"
                />
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
              className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2"
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
                <p className="text-xs text-gray-400 mt-1">
                  可用变量: {'{{url}}'} {'{{platform}}'} {'{{itemId}}'} {'{{shopId}}'} {'{{title}}'} {'{{price}}'} {'{{skuId}}'} {'{{collectedAt}}'}
                </p>
              </div>
            )}
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{testResult.message}</span>
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

      {/* Info */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>提示：</strong>请向你的 ERP 开发人员获取 API 地址和认证信息。
            开启"自动推送"后，每次采集链接会自动发送到 ERP。
            如果不确定如何配置，可以把你的 ERP 系统名称告诉我，我帮你做精准适配。
          </span>
        </p>
      </div>
    </div>
  );
}
