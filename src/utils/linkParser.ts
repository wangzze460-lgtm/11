export interface ProductInfo {
  id: string;
  platform: 'shopee' | 'lazada' | 'unknown';
  url: string;
  title?: string;
  description?: string;
  price?: string;
  originalPrice?: string;
  shopName?: string;
  shopId?: string;
  itemId?: string;
  skuId?: string;
  images?: string[];
  specifications?: Record<string, string>;
  variants?: Array<{
    name: string;
    price?: string;
    stock?: number;
  }>;
  rating?: number;
  soldCount?: number;
  category?: string;
  collectedAt: string;
}

export function parseShopeeUrl(url: string): Partial<ProductInfo> {
  const info: Partial<ProductInfo> = { platform: 'shopee', url };

  // 提取 item-id 和 shop-id
  const itemIdMatch = url.match(/i\.(\d+)/);
  const shopIdMatch = url.match(/shop\/(\d+)/);
  const itemIdMatch2 = url.match(/item\.(\d+)/);
  const itemIdMatch3 = url.match(/product\/(\d+)/);

  if (itemIdMatch) info.itemId = itemIdMatch[1];
  if (shopIdMatch) info.shopId = shopIdMatch[1];
  if (itemIdMatch2) info.itemId = itemIdMatch2[1];
  if (itemIdMatch3) info.itemId = itemIdMatch3[1];

  // 从路径提取标题
  const pathMatch = url.match(/\/product\/([^/?]+)/);
  if (pathMatch) {
    info.title = decodeURIComponent(pathMatch[1]).replace(/-/g, ' ');
  }

  // 提取 SKU
  const skuMatch = url.match(/sku[_-]?id=(\d+)/i) || url.match(/#(\d+)$/);
  if (skuMatch) info.skuId = skuMatch[1];

  return info;
}

export function parseLazadaUrl(url: string): Partial<ProductInfo> {
  const info: Partial<ProductInfo> = { platform: 'lazada', url };

  // 提取 item id
  const itemIdMatch = url.match(/i(\d+)/);
  const skuMatch = url.match(/-s(\d+)/);

  if (itemIdMatch) info.itemId = itemIdMatch[1];
  if (skuMatch) info.skuId = skuMatch[1];

  // 从路径提取标题
  const pathMatch = url.match(/\/products\/([^/?]+)/);
  if (pathMatch) {
    info.title = decodeURIComponent(pathMatch[1]).replace(/-/g, ' ');
  }

  return info;
}

export function detectPlatform(url: string): 'shopee' | 'lazada' | 'unknown' {
  if (/shopee\./i.test(url) || /shp\.ee/i.test(url)) return 'shopee';
  if (/lazada\./i.test(url)) return 'lazada';
  return 'unknown';
}

export function parseProductUrl(url: string): ProductInfo {
  const platform = detectPlatform(url);
  let info: Partial<ProductInfo>;

  switch (platform) {
    case 'shopee':
      info = parseShopeeUrl(url);
      break;
    case 'lazada':
      info = parseLazadaUrl(url);
      break;
    default:
      info = { platform: 'unknown', url };
  }

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    platform: info.platform || 'unknown',
    url: info.url || url,
    title: info.title,
    itemId: info.itemId,
    shopId: info.shopId,
    skuId: info.skuId,
    collectedAt: new Date().toISOString(),
  };
}

export function exportToCSV(products: ProductInfo[]): string {
  const headers = ['平台', '商品ID', '店铺ID', 'SKU ID', '标题', '价格', '原价', '店铺名称', '评分', '销量', '商品描述', '图片数量', '规格数量', '变体数量', '链接', '采集时间'];
  const rows = products.map(p => [
    p.platform === 'shopee' ? 'Shopee' : p.platform === 'lazada' ? 'Lazada' : '未知',
    p.itemId || '',
    p.shopId || '',
    p.skuId || '',
    p.title || '',
    p.price || '',
    p.originalPrice || '',
    p.shopName || '',
    p.rating?.toString() || '',
    p.soldCount?.toString() || '',
    (p.description || '').substring(0, 200),
    p.images?.length.toString() || '0',
    p.specifications ? Object.keys(p.specifications).length.toString() : '0',
    p.variants?.length.toString() || '0',
    p.url,
    new Date(p.collectedAt).toLocaleString('zh-CN'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return '\uFEFF' + csvContent; // BOM for Excel
}
