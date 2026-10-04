export const manifestJson = `{
  "manifest_version": 3,
  "name": "Shopee & Lazada 链接采集器",
  "version": "1.0.0",
  "description": "一键采集Shopee和Lazada前台商品完整链接，支持批量导出",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "https://*.shopee.*/*",
    "https://*.lazada.*/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.shopee.*/*",
        "https://*.lazada.*/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}`;

export const backgroundJs = `// background.js - Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Shopee & Lazada 链接采集器已安装');
  // 初始化存储
  chrome.storage.local.set({ collectedLinks: [], settings: { autoCollect: false } });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COLLECT_LINK') {
    chrome.storage.local.get('collectedLinks', (result) => {
      const links = result.collectedLinks || [];
      links.push({
        ...message.data,
        collectedAt: new Date().toISOString()
      });
      chrome.storage.local.set({ collectedLinks: links });
      sendResponse({ success: true, count: links.length });
    });
    return true; // 异步响应
  }
  
  if (message.type === 'GET_LINKS') {
    chrome.storage.local.get('collectedLinks', (result) => {
      sendResponse({ links: result.collectedLinks || [] });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_LINKS') {
    chrome.storage.local.set({ collectedLinks: [] });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'BATCH_COLLECT') {
    // 批量采集当前页面所有商品链接
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: collectAllLinks
        }).then((results) => {
          if (results && results[0]) {
            const links = results[0].result || [];
            chrome.storage.local.get('collectedLinks', (result) => {
              const existing = result.collectedLinks || [];
              const newLinks = [...existing, ...links.map(link => ({
                ...link,
                collectedAt: new Date().toISOString()
              }))];
              chrome.storage.local.set({ collectedLinks: newLinks });
              sendResponse({ success: true, count: newLinks.length, added: links.length });
            });
          }
        });
      }
    });
    return true;
  }
});

// 在页面中执行的批量采集函数
function collectAllLinks() {
  const links = [];
  const currentUrl = window.location.href;
  
  if (currentUrl.includes('shopee')) {
    // Shopee 商品链接采集
    const productLinks = document.querySelectorAll('a[href*="/product/"], a[href*="i."], a[href*="/item/"]');
    productLinks.forEach(a => {
      const href = a.href;
      if (href && (href.includes('/product/') || href.includes('i.'))) {
        const title = a.textContent?.trim() || a.getAttribute('title') || '';
        const itemIdMatch = href.match(/i\\.(\\d+)/) || href.match(/item\\.(\\d+)/);
        links.push({
          platform: 'shopee',
          url: href,
          title: title.substring(0, 100),
          itemId: itemIdMatch ? itemIdMatch[1] : ''
        });
      }
    });
  } else if (currentUrl.includes('lazada')) {
    // Lazada 商品链接采集
    const productLinks = document.querySelectorAll('a[href*="/products/"], a[href*="html"]');
    productLinks.forEach(a => {
      const href = a.href;
      if (href && (href.includes('/products/') || href.includes('.html'))) {
        const title = a.textContent?.trim() || a.getAttribute('title') || '';
        const itemIdMatch = href.match(/i(\\d+)/);
        links.push({
          platform: 'lazada',
          url: href,
          title: title.substring(0, 100),
          itemId: itemIdMatch ? itemIdMatch[1] : ''
        });
      }
    });
  }
  
  // 去重
  const uniqueLinks = [...new Map(links.map(l => [l.url, l])).values()];
  return uniqueLinks;
}
`;

export const contentJs = `// content.js - Content Script
(function() {
  'use strict';
  
  const currentUrl = window.location.href;
  const isShopee = currentUrl.includes('shopee');
  const isLazada = currentUrl.includes('lazada');
  
  if (!isShopee && !isLazada) return;
  
  // 提取商品详情的函数
  function extractProductDetail() {
    const detail = {
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      images: [],
      specifications: {},
      variants: [],
      rating: 0,
      soldCount: 0,
      shopName: '',
      category: ''
    };
    
    if (isShopee) {
      // 标题
      const titleEl = document.querySelector('h1, [class*="product-title"], [class*="pdp-product-title"]');
      detail.title = titleEl?.textContent?.trim() || '';
      
      // 价格
      const priceEl = document.querySelector('[class*="product-price"], [class*="price"]');
      detail.price = priceEl?.textContent?.trim() || '';
      
      // 原价
      const originalPriceEl = document.querySelector('[class*="original-price"], [class*="price--original"]');
      detail.originalPrice = originalPriceEl?.textContent?.trim() || '';
      
      // 图片 - 使用更通用的选择器
      const imageSelectors = [
        '[class*="product-image"] img',
        '[class*="slider"] img',
        '[class*="carousel"] img',
        '[class*="gallery"] img',
        '[class*="thumbnail"] img',
        'img[src*="cf.shopee"]',
        'img[src*="shopee"]',
        '.product-detail img',
        '[data-testid*="image"] img'
      ];
      
      const imageEls = document.querySelectorAll(imageSelectors.join(', '));
      imageEls.forEach(img => {
        // 尝试多种属性获取图片URL
        const src = img.src || 
                   img.getAttribute('data-src') || 
                   img.getAttribute('data-srcset')?.split(' ')[0] ||
                   img.getAttribute('srcset')?.split(' ')[0];
        
        // 过滤有效图片（排除小图标、logo等）
        if (src && 
            !detail.images.includes(src) && 
            !src.includes('icon') && 
            !src.includes('logo') &&
            (src.includes('http') || src.startsWith('//'))) {
          // 转换为完整URL
          const fullUrl = src.startsWith('//') ? 'https:' + src : src;
          detail.images.push(fullUrl);
        }
      });
      
      // 如果还没找到图片，尝试从页面中查找所有大图
      if (detail.images.length === 0) {
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          
          // 只收集较大的图片（可能是商品图）
          if (src && width > 200 && height > 200 && !detail.images.includes(src)) {
            const fullUrl = src.startsWith('//') ? 'https:' + src : src;
            detail.images.push(fullUrl);
          }
        });
      }
      
      // 描述
      const descEl = document.querySelector('[class*="product-description"], [class*="description"]');
      detail.description = descEl?.textContent?.trim() || '';
      
      // 规格
      const specEls = document.querySelectorAll('[class*="specification"] tr, [class*="specs"] li');
      specEls.forEach(el => {
        const label = el.querySelector('td:first-child, .label, dt')?.textContent?.trim();
        const value = el.querySelector('td:last-child, .value, dd')?.textContent?.trim();
        if (label && value) {
          detail.specifications[label] = value;
        }
      });
      
      // 变体/SKU
      const variantEls = document.querySelectorAll('[class*="product-variant"] button, [class*="sku"] button');
      variantEls.forEach(el => {
        const name = el.textContent?.trim();
        if (name) {
          detail.variants.push({ name });
        }
      });
      
      // 评分
      const ratingEl = document.querySelector('[class*="rating"], [class*="star"]');
      const ratingText = ratingEl?.textContent?.match(/([\\d.]+)/);
      if (ratingText) {
        detail.rating = parseFloat(ratingText[1]);
      }
      
      // 销量
      const soldEl = document.querySelector('[class*="sold"], [class*="sales"]');
      const soldText = soldEl?.textContent?.match(/([\\d,]+)/);
      if (soldText) {
        detail.soldCount = parseInt(soldText[1].replace(/,/g, ''));
      }
      
      // 店铺名
      const shopEl = document.querySelector('[class*="shop-name"], [class*="seller-name"]');
      detail.shopName = shopEl?.textContent?.trim() || '';
      
    } else if (isLazada) {
      // 标题
      const titleEl = document.querySelector('h1, [class*="pdp-product-title"]');
      detail.title = titleEl?.textContent?.trim() || '';
      
      // 价格
      const priceEl = document.querySelector('[class*="pdp-price"], [class*="product-price"]');
      detail.price = priceEl?.textContent?.trim() || '';
      
      // 原价
      const originalPriceEl = document.querySelector('[class*="pdp-original-price"]');
      detail.originalPrice = originalPriceEl?.textContent?.trim() || '';
      
      // 图片 - 使用更通用的选择器
      const imageSelectors = [
        '[class*="pdp-mod-common-image"] img',
        '[class*="gallery"] img',
        '[class*="slider"] img',
        '[class*="carousel"] img',
        '[class*="thumbnail"] img',
        'img[src*="lazada"]',
        'img[src*="lzd"]',
        '.pdp-block img',
        '[data-testid*="image"] img'
      ];
      
      const imageEls = document.querySelectorAll(imageSelectors.join(', '));
      imageEls.forEach(img => {
        const src = img.src || 
                   img.getAttribute('data-src') || 
                   img.getAttribute('data-srcset')?.split(' ')[0] ||
                   img.getAttribute('srcset')?.split(' ')[0];
        
        if (src && 
            !detail.images.includes(src) && 
            !src.includes('icon') && 
            !src.includes('logo') &&
            (src.includes('http') || src.startsWith('//'))) {
          const fullUrl = src.startsWith('//') ? 'https:' + src : src;
          detail.images.push(fullUrl);
        }
      });
      
      // 如果还没找到图片，尝试从页面中查找所有大图
      if (detail.images.length === 0) {
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          
          if (src && width > 200 && height > 200 && !detail.images.includes(src)) {
            const fullUrl = src.startsWith('//') ? 'https:' + src : src;
            detail.images.push(fullUrl);
          }
        });
      }
      
      // 描述
      const descEl = document.querySelector('[class*="pdp-product-description"], [class*="product-description"]');
      detail.description = descEl?.textContent?.trim() || '';
      
      // 规格
      const specEls = document.querySelectorAll('[class*="specification"] tr, [class*="specifications"] li');
      specEls.forEach(el => {
        const label = el.querySelector('td:first-child, .title')?.textContent?.trim();
        const value = el.querySelector('td:last-child, .value')?.textContent?.trim();
        if (label && value) {
          detail.specifications[label] = value;
        }
      });
      
      // 变体
      const variantEls = document.querySelectorAll('[class*="sku-selection"] button, [class*="variant"] button');
      variantEls.forEach(el => {
        const name = el.textContent?.trim();
        if (name) {
          detail.variants.push({ name });
        }
      });
      
      // 评分
      const ratingEl = document.querySelector('[class*="pdp-review-summary"]');
      const ratingText = ratingEl?.textContent?.match(/([\\d.]+)/);
      if (ratingText) {
        detail.rating = parseFloat(ratingText[1]);
      }
      
      // 销量
      const soldEl = document.querySelector('[class*="pdp-review-summary"] [class*="number"]');
      const soldText = soldEl?.textContent?.match(/([\\d,]+)/);
      if (soldText) {
        detail.soldCount = parseInt(soldText[1].replace(/,/g, ''));
      }
      
      // 店铺名
      const shopEl = document.querySelector('[class*="pdp-link"], [class*="seller-name"]');
      detail.shopName = shopEl?.textContent?.trim() || '';
    }
    
    return detail;
  }
  
  // 创建浮动采集按钮
  function createFloatingButton() {
    const container = document.createElement('div');
    container.id = 'link-collector-btn';
    container.innerHTML = \`
      <div class="lc-floating-btn" title="采集当前页面链接">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    \`;
    document.body.appendChild(container);
    
    container.querySelector('.lc-floating-btn').addEventListener('click', () => {
      collectCurrentPage();
    });
  }
  
  // 采集当前页面
  function collectCurrentPage() {
    const links = [];
    
    if (isShopee) {
      // 采集 Shopee 商品页链接
      const productElements = document.querySelectorAll(
        'a[href*="/product/"], a[href*="i."], a[href*="/item/"], [data-sqe="item"]'
      );
      
      productElements.forEach(el => {
        const a = el.tagName === 'A' ? el : el.querySelector('a');
        if (!a) return;
        
        let href = a.href || a.getAttribute('href') || '';
        if (href.startsWith('/')) {
          href = window.location.origin + href;
        }
        
        if (href.includes('shopee') && (href.includes('/product/') || href.includes('i.'))) {
          const title = el.textContent?.trim().substring(0, 100) || '';
          const itemIdMatch = href.match(/i\\.(\\d+)/) || href.match(/item\\.(\\d+)/);
          const shopIdMatch = href.match(/shop\\/(\\d+)/);
          
          links.push({
            platform: 'shopee',
            url: href,
            title,
            itemId: itemIdMatch ? itemIdMatch[1] : '',
            shopId: shopIdMatch ? shopIdMatch[1] : ''
          });
        }
      });
      
      // 如果是商品详情页，采集当前商品信息（包含完整详情）
      const detailUrl = window.location.href;
      if (detailUrl.includes('/product/') || detailUrl.includes('i.')) {
        const detail = extractProductDetail();
        
        links.unshift({
          platform: 'shopee',
          url: detailUrl,
          title: detail.title,
          description: detail.description,
          price: detail.price,
          originalPrice: detail.originalPrice,
          images: detail.images,
          specifications: detail.specifications,
          variants: detail.variants,
          rating: detail.rating,
          soldCount: detail.soldCount,
          shopName: detail.shopName,
          category: detail.category,
          itemId: (detailUrl.match(/i\\.(\\d+)/) || [])[1] || '',
          shopId: (detailUrl.match(/shop\\/(\\d+)/) || [])[1] || ''
        });
      }
    }
    
    if (isLazada) {
      // 采集 Lazada 商品页链接
      const productElements = document.querySelectorAll(
        'a[href*="/products/"], a[href*=".html"], [class*="product-card"]'
      );
      
      productElements.forEach(el => {
        const a = el.tagName === 'A' ? el : el.querySelector('a');
        if (!a) return;
        
        let href = a.href || a.getAttribute('href') || '';
        if (href.startsWith('/')) {
          href = window.location.origin + href;
        }
        
        if (href.includes('lazada') && (href.includes('/products/') || href.includes('.html'))) {
          const title = el.textContent?.trim().substring(0, 100) || '';
          const itemIdMatch = href.match(/i(\\d+)/);
          const skuMatch = href.match(/-s(\\d+)/);
          
          links.push({
            platform: 'lazada',
            url: href,
            title,
            itemId: itemIdMatch ? itemIdMatch[1] : '',
            skuId: skuMatch ? skuMatch[1] : ''
          });
        }
      });
      
      // 商品详情页（包含完整详情）
      const detailUrl = window.location.href;
      if (detailUrl.includes('/products/') || detailUrl.includes('.html')) {
        const detail = extractProductDetail();
        
        links.unshift({
          platform: 'lazada',
          url: detailUrl,
          title: detail.title,
          description: detail.description,
          price: detail.price,
          originalPrice: detail.originalPrice,
          images: detail.images,
          specifications: detail.specifications,
          variants: detail.variants,
          rating: detail.rating,
          soldCount: detail.soldCount,
          shopName: detail.shopName,
          category: detail.category,
          itemId: (detailUrl.match(/i(\\d+)/) || [])[1] || '',
          skuId: (detailUrl.match(/-s(\\d+)/) || [])[1] || ''
        });
      }
    }
    
    // 去重
    const uniqueLinks = [...new Map(links.map(l => [l.url, l])).values()];
    
    // 发送到 background
    uniqueLinks.forEach(link => {
      chrome.runtime.sendMessage({
        type: 'COLLECT_LINK',
        data: link
      });
    });
    
    // 显示采集结果提示
    showNotification(\`已采集 \${uniqueLinks.length} 个商品链接\`);
  }
  
  // 显示通知
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'lc-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('lc-notification-hide');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // 页面加载完成后创建按钮
  if (document.readyState === 'complete') {
    createFloatingButton();
  } else {
    window.addEventListener('load', createFloatingButton);
  }
})();
`;

export const contentCss = `/* content.css */
#link-collector-btn {
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 99999;
}

.lc-floating-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ee4d2d, #ff6633);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(238, 77, 45, 0.4);
  transition: all 0.3s ease;
}

.lc-floating-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(238, 77, 45, 0.6);
}

.lc-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #333;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 999999;
  animation: lc-slide-in 0.3s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.lc-notification-hide {
  opacity: 0;
  transform: translateY(-20px);
  transition: all 0.3s ease;
}

@keyframes lc-slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

export const popupHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>链接采集器</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <div class="header">
      <h1>🔗 链接采集器</h1>
      <span class="badge" id="count-badge">0</span>
    </div>
    
    <div class="actions">
      <button id="btn-collect" class="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        采集当前页面
      </button>
      <button id="btn-batch" class="btn btn-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        批量采集
      </button>
    </div>
    
    <div class="link-list" id="link-list">
      <div class="empty-state">
        <p>暂无采集的链接</p>
        <p class="hint">浏览 Shopee 或 Lazada 时点击采集按钮</p>
      </div>
    </div>
    
    <div class="footer">
      <button id="btn-export" class="btn btn-export">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        导出CSV
      </button>
      <button id="btn-clear" class="btn btn-danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
        </svg>
        清空
      </button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;

export const popupJs = `// popup.js
document.addEventListener('DOMContentLoaded', () => {
  loadLinks();
  
  document.getElementById('btn-collect').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: collectCurrentPageLinks
        }).then(() => {
          setTimeout(loadLinks, 500);
        });
      }
    });
  });
  
  document.getElementById('btn-batch').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BATCH_COLLECT' }, (response) => {
      if (response && response.success) {
        setTimeout(loadLinks, 500);
      }
    });
  });
  
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-clear').addEventListener('click', clearLinks);
});

function loadLinks() {
  chrome.runtime.sendMessage({ type: 'GET_LINKS' }, (response) => {
    const links = response?.links || [];
    const listEl = document.getElementById('link-list');
    const badgeEl = document.getElementById('count-badge');
    
    badgeEl.textContent = links.length;
    
    if (links.length === 0) {
      listEl.innerHTML = \`
        <div class="empty-state">
          <p>暂无采集的链接</p>
          <p class="hint">浏览 Shopee 或 Lazada 时点击采集按钮</p>
        </div>
      \`;
      return;
    }
    
    listEl.innerHTML = links.reverse().map(link => \`
      <div class="link-item">
        <div class="link-platform \${link.platform}">
          \${link.platform === 'shopee' ? '🟠' : '🔵'}
        </div>
        <div class="link-info">
          <div class="link-title">\${link.title || '无标题'}</div>
          <div class="link-url" title="\${link.url}">\${link.url.substring(0, 50)}...</div>
        </div>
        <button class="btn-copy" data-url="\${link.url}" title="复制链接">📋</button>
      </div>
    \`).join('');
    
    // 绑定复制按钮
    listEl.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.url);
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1000);
      });
    });
  });
}

function exportCSV() {
  chrome.runtime.sendMessage({ type: 'GET_LINKS' }, (response) => {
    const links = response?.links || [];
    if (links.length === 0) {
      alert('没有可导出的链接');
      return;
    }
    
    const headers = ['平台', '商品ID', '店铺ID', '标题', '链接', '采集时间'];
    const rows = links.map(l => [
      l.platform === 'shopee' ? 'Shopee' : 'Lazada',
      l.itemId || '',
      l.shopId || '',
      l.title || '',
      l.url,
      new Date(l.collectedAt).toLocaleString()
    ]);
    
    const csv = '\\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(c => '"' + c + '"').join(','))
    ].join('\\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collected_links_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function clearLinks() {
  if (confirm('确定要清空所有采集的链接吗？')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_LINKS' }, () => {
      loadLinks();
    });
  }
}

function collectCurrentPageLinks() {
  const links = [];
  const url = window.location.href;
  
  if (url.includes('shopee')) {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const price = document.querySelector('[class*="price"]')?.textContent?.trim() || '';
    links.push({
      platform: 'shopee',
      url: url,
      title,
      price,
      itemId: (url.match(/i\\.(\\d+)/) || [])[1] || '',
      shopId: (url.match(/shop\\/(\\d+)/) || [])[1] || ''
    });
  } else if (url.includes('lazada')) {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const price = document.querySelector('[class*="price"]')?.textContent?.trim() || '';
    links.push({
      platform: 'lazada',
      url: url,
      title,
      price,
      itemId: (url.match(/i(\\d+)/) || [])[1] || '',
      skuId: (url.match(/-s(\\d+)/) || [])[1] || ''
    });
  }
  
  links.forEach(link => {
    chrome.runtime.sendMessage({ type: 'COLLECT_LINK', data: link });
  });
  
  return links.length;
}
`;

export const popupCss = `/* popup.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 380px;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8f9fa;
}

.popup-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, #ee4d2d, #ff6633);
  color: white;
}

.header h1 {
  font-size: 16px;
  font-weight: 600;
}

.badge {
  background: rgba(255,255,255,0.3);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eee;
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #ee4d2d;
  color: white;
  flex: 1;
}

.btn-primary:hover {
  background: #d4432a;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
  flex: 1;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.link-list {
  flex: 1;
  overflow-y: auto;
  max-height: 300px;
  padding: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  margin-bottom: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.link-platform {
  font-size: 18px;
  flex-shrink: 0;
}

.link-info {
  flex: 1;
  min-width: 0;
}

.link-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-url {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.btn-copy {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-copy:hover {
  background: #f0f0f0;
}

.footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #eee;
}

.btn-export {
  background: #4CAF50;
  color: white;
  flex: 1;
}

.btn-export:hover {
  background: #43a047;
}

.btn-danger {
  background: #ff5252;
  color: white;
}

.btn-danger:hover {
  background: #f44336;
}
`;

export const extensionFiles = {
  'manifest.json': manifestJson,
  'background.js': backgroundJs,
  'content.js': contentJs,
  'content.css': contentCss,
  'popup.html': popupHtml,
  'popup.js': popupJs,
  'popup.css': popupCss,
};
