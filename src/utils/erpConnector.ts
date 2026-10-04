export interface ERPConfig {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'custom';
  apiUrl: string;
  apiKey?: string;
  apiSecret?: string;
  authToken?: string;
  authType: 'bearer' | 'basic' | 'apikey' | 'custom' | 'none';
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  bodyTemplate: string;
  fieldMapping: {
    url: string;
    platform: string;
    itemId: string;
    shopId: string;
    title: string;
    price: string;
    skuId: string;
  };
  autoPush: boolean;
  lastSync?: string;
  enabled: boolean;
}

export const defaultFieldMapping = {
  url: 'product_url',
  platform: 'platform',
  itemId: 'item_id',
  shopId: 'shop_id',
  title: 'title',
  price: 'price',
  skuId: 'sku_id',
};

// 常见 ERP 预设模板
export const erpPresets: Record<string, Partial<ERPConfig>> = {
  'mabang': {
    name: '马帮 ERP',
    type: 'api',
    authType: 'custom',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      appKey: '{{apiKey}}',
      timestamp: '{{timestamp}}',
      sign: '{{sign}}',
      data: {
        productUrl: '{{url}}',
        platform: '{{platform}}',
        itemId: '{{itemId}}',
        shopId: '{{shopId}}',
        title: '{{title}}',
      }
    }, null, 2),
  },
  'tongtool': {
    name: '通途 ERP',
    type: 'api',
    authType: 'basic',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      productUrl: '{{url}}',
      platform: '{{platform}}',
      sku: '{{itemId}}',
      title: '{{title}}',
    }, null, 2),
  },
  'dianxiaomi': {
    name: '店小秘',
    type: 'api',
    authType: 'apikey',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      url: '{{url}}',
      platform: '{{platform}}',
      productId: '{{itemId}}',
      sellerId: '{{shopId}}',
      name: '{{title}}',
    }, null, 2),
  },
  'winit': {
    name: '万邑通',
    type: 'api',
    authType: 'bearer',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      productUrl: '{{url}}',
      platform: '{{platform}}',
      itemCode: '{{itemId}}',
      shopCode: '{{shopId}}',
      productName: '{{title}}',
    }, null, 2),
  },
  'generic': {
    name: '通用 API',
    type: 'api',
    authType: 'bearer',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      url: '{{url}}',
      platform: '{{platform}}',
      itemId: '{{itemId}}',
      shopId: '{{shopId}}',
      title: '{{title}}',
      price: '{{price}}',
      skuId: '{{skuId}}',
    }, null, 2),
  },
  'webhook': {
    name: 'Webhook (通用)',
    type: 'webhook',
    authType: 'none',
    method: 'POST',
    bodyTemplate: JSON.stringify({
      event: 'product_collected',
      data: {
        url: '{{url}}',
        platform: '{{platform}}',
        itemId: '{{itemId}}',
        shopId: '{{shopId}}',
        title: '{{title}}',
        price: '{{price}}',
        skuId: '{{skuId}}',
        collectedAt: '{{collectedAt}}',
      }
    }, null, 2),
  },
};

export function buildRequestBody(
  template: string,
  data: Record<string, string>
): string {
  let body = template;
  for (const [key, value] of Object.entries(data)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return body;
}

export async function pushToERP(
  config: ERPConfig,
  productData: Record<string, string>
): Promise<{ success: boolean; message: string; response?: any }> {
  try {
    const body = buildRequestBody(config.bodyTemplate, productData);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // 添加认证
    switch (config.authType) {
      case 'bearer':
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        break;
      case 'basic':
        if (config.apiKey && config.apiSecret) {
          const credentials = btoa(`${config.apiKey}:${config.apiSecret}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'apikey':
        if (config.apiKey) {
          headers['X-API-Key'] = config.apiKey;
        }
        break;
      case 'custom':
        // 自定义认证，通过模板处理
        break;
    }

    const response = await fetch(config.apiUrl, {
      method: config.method,
      headers,
      body,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      return {
        success: true,
        message: `推送成功 (${response.status})`,
        response: responseData,
      };
    } else {
      return {
        success: false,
        message: `推送失败 (${response.status}): ${responseText.substring(0, 200)}`,
        response: responseData,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `请求错误: ${error.message}`,
    };
  }
}

export function saveERPConfig(config: ERPConfig): void {
  const configs = getERPConfigs();
  const index = configs.findIndex(c => c.id === config.id);
  if (index >= 0) {
    configs[index] = config;
  } else {
    configs.push(config);
  }
  localStorage.setItem('erp_configs', JSON.stringify(configs));
}

export function getERPConfigs(): ERPConfig[] {
  try {
    const data = localStorage.getItem('erp_configs');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteERPConfig(id: string): void {
  const configs = getERPConfigs().filter(c => c.id !== id);
  localStorage.setItem('erp_configs', JSON.stringify(configs));
}
