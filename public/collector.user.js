// ═══════════════════════════════════════════════════════════
// 商品采集器 v10.0 - Lazada / Shopee / 1688 通用版
// 安装后只需修改下方【配置区】，其他代码无需改动
// ═══════════════════════════════════════════════════════════
// ==UserScript==
// @name         商品采集器
// @namespace    zancuren
// @version      10.0
// @description  Lazada/Shopee/1688 商品采集，自动推送 ERP
// @match        *://*.lazada.*/*
// @match        *://*.shopee.*/*
// @match        *://*.1688.com/*
// @match        *://detail.1688.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // 【配置区】只改这里，其他不用动
  // ═══════════════════════════════════════════════════════════
  const CONFIG = {
    // ERP 接口地址
    erpUrl: 'https://erp.zancuren.com/api/products/collect',
    // ERP Token（Bearer）
    erpToken: '11a95ccfc9050ba877815d125585d502',
    // 采集间隔（毫秒），太快可能被限流
    collectInterval: 1000,
    // 是否自动推送 ERP（false 则只保存本地）
    autoPush: true,
    // 图片最大数量
    maxImages: 20,
    // 是否显示调试面板
    showDebug: true,
    // 图片最小尺寸（过滤小图标）
    minImageSize: 300,
  };

  // ═══════════════════════════════════════════════════════════
  // 【采集统计】自检提示用
  // ═══════════════════════════════════════════════════════════
  const STATS = {
    success: 0,
    fail: 0,
    total: 0,
    history: [],
  };

  // ═══════════════════════════════════════════════════════════
  // 【样式】
  // ═══════════════════════════════════════════════════════════
  GM_addStyle(`
    #collector-toggle{position:fixed;top:20px;right:20px;padding:10px 15px;background:#6366f1;color:white;border:2px solid white;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;z-index:9999999999;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
    #collector-toggle:hover{background:#4f46e5}
    #collector-main-btn{position:fixed;top:80px;right:20px;padding:20px 30px;background:linear-gradient(135deg,#ff6600,#ff8800);color:white;border:3px solid white;border-radius:12px;font-size:18px;font-weight:bold;cursor:pointer;z-index:999999998;box-shadow:0 8px 24px rgba(255,102,0,0.4);transition:all 0.3s}
    #collector-main-btn:hover{transform:scale(1.05)}
    #collector-debug-btn{position:fixed;top:160px;right:20px;padding:15px 25px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:3px solid white;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;z-index:999999998}
    #collector-panel{position:fixed;bottom:20px;right:20px;width:500px;max-height:400px;background:white;border:2px solid #ff6600;border-radius:12px;padding:15px;z-index:999999999;overflow-y:auto;font-size:12px;font-family:monospace;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:none}
    #collector-panel.show{display:block}
    #collector-panel h3{margin:0 0 10px 0;font-size:14px;color:#ff6600}
    .cl-log{margin:5px 0;padding:5px;background:#f5f5f5;border-radius:4px;word-break:break-all}
    .cl-error{background:#ffebee;color:#c62828}
    .cl-success{background:#e8f5e9;color:#2e7d32}
    .cl-hidden{display:none !important}
  `);

  // ═══════════════════════════════════════════════════════════
  // 【工具函数】
  // ═══════════════════════════════════════════════════════════

  function log(message, type = 'info') {
    if (!CONFIG.showDebug) return;
    const panel = document.getElementById('collector-panel');
    if (!panel) return;
    const logDiv = document.createElement('div');
    logDiv.className = `cl-log ${type === 'error' ? 'cl-error' : type === 'success' ? 'cl-success' : ''}`;
    logDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    panel.appendChild(logDiv);
    panel.scrollTop = panel.scrollHeight;
    console.log(message);
  }

  // 高清图片 URL 处理（彻底去掉尺寸后缀）
  function convertToHDImage(url) {
    if (!url) return url;
    // 去掉所有尺寸后缀
    url = url.replace(/_\d+x\d+\.jpg/g, '.jpg');
    url = url.replace(/_\d+x\d+\.png/g, '.png');
    url = url.replace(/_\d+x\d+\.webp/g, '.webp');
    // 去掉 Lazada 特有参数
    url = url.replace(/-scale_\d+_\d+/g, '');
    url = url.replace(/\/resize,\d+,\d+/g, '');
    url = url.replace(/\?x-oss-process=image\/resize[^&]*/g, '');
    // 去掉所有查询参数
    url = url.split('?')[0];
    // 去掉缩略图标记
    url = url.replace(/_thumb/g, '').replace(/_small/g, '').replace(/_mini/g, '');
    // 确保完整 URL
    if (url.startsWith('//')) url = 'https:' + url;
    return url;
  }

  // 精准判断商品图片（排除 logo/图标/广告）
  function isProductImage(url, img) {
    if (!url || (!url.startsWith('http') && !url.startsWith('//'))) return false;
    const excludeKeywords = [
      'icon', 'logo', 'sprite', 'avatar', 'badge', 'flag',
      'banner', 'ad-', 'ads/', 'promotion', 'coupon',
      'rating-star', 'star-empty', 'star-full',
      'loading', 'placeholder', 'default',
      'payment', 'shipping', 'delivery',
      'chat', 'message', 'notification',
      'facebook', 'twitter', 'instagram', 'line',
      'app-store', 'google-play', 'qr-code',
      'seller-badge', 'lazmall', 'taobao', 'tmall'
    ];
    const urlLower = url.toLowerCase();
    for (let kw of excludeKeywords) {
      if (urlLower.includes(kw)) return false;
    }
    if (img) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && (w < CONFIG.minImageSize || h < CONFIG.minImageSize)) return false;
    }
    const includeKeywords = ['lazada', 'lzd', 'alicdn', 'shopee', '1688', 'product', 'gallery', 'pdp'];
    for (let kw of includeKeywords) {
      if (urlLower.includes(kw)) return true;
    }
    if (img) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 500 && h > 500) return true;
    }
    return false;
  }

  // 平台识别
  function detectPlatform() {
    const url = window.location.href;
    if (url.includes('lazada')) return 'lazada';
    if (url.includes('shopee')) return 'shopee';
    if (url.includes('1688')) return '1688';
    return 'unknown';
  }

  // 从页面 script 标签提取 JSON 数据
  function extractDataFromScripts(patterns) {
    const results = [];
    try {
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        const text = script.textContent;
        for (let pattern of patterns) {
          const matches = text.matchAll(new RegExp(pattern, 'g'));
          for (let match of matches) {
            try {
              results.push(JSON.parse(match[1]));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // 【采集逻辑】
  // ═══════════════════════════════════════════════════════════

  function collectProduct() {
    const platform = detectPlatform();
    const site = window.location.hostname;
    log(`🔍 平台：${platform}，站点：${site}`);

    const product = {
      url: window.location.href,
      platform: platform,
      site: site,
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      images: [],
      itemId: '',
      shopId: '',
      skuId: '',
      shopName: '',
      rating: 0,
      soldCount: 0,
      specifications: {},
      variants: [],
      collectedAt: new Date().toISOString(),
    };

    if (platform === 'lazada') collectLazada(product);
    else if (platform === 'shopee') collectShopee(product);
    else if (platform === '1688') collect1688(product);

    return product;
  }

  // ---------- Lazada ----------
  function collectLazada(product) {
    // 标题
    const titleEl = document.querySelector('h1');
    if (titleEl) {
      product.title = titleEl.textContent.trim();
      log(`✅ 标题：${product.title.substring(0, 40)}...`);
    }

    // 价格
    const priceEl = document.querySelector('.pdp-price, [class*="pdp-price"]');
    if (priceEl) {
      product.price = priceEl.textContent.trim();
      log(`✅ 价格：${product.price}`);
    }

    // 原价
    const origEl = document.querySelector('[class*="pdp-original-price"]');
    if (origEl) {
      product.originalPrice = origEl.textContent.trim();
      log(`✅ 原价：${product.originalPrice}`);
    }

    // 描述（过滤页脚）
    const descEl = document.querySelector('[class*="pdp-product-description"]');
    if (descEl) {
      let desc = descEl.innerText.trim();
      desc = desc.replace(/If you want to report[\s\S]*/i, '').trim();
      desc = desc.replace(/Report this product[\s\S]*/i, '').trim();
      product.description = desc;
      log(`✅ 描述：${product.description.length} 字符`);
    }

    // 高清图片
    const imageSet = new Set();
    const mainArea = document.querySelector('[class*="pdp-mod-common-image"], [class*="gallery"]');
    if (mainArea) {
      mainArea.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
        if (src && isProductImage(src, img)) {
          imageSet.add(convertToHDImage(src));
        }
      });
    }
    if (imageSet.size < 3) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        if (src && isProductImage(src, img)) {
          imageSet.add(convertToHDImage(src));
        }
      });
    }
    const imgData = extractDataFromScripts(['"images"\\s*:\\s*(\\[[\\s\\S]*?\\])', '"gallery"\\s*:\\s*(\\[[\\s\\S]*?\\])']);
    imgData.forEach(data => {
      if (Array.isArray(data)) {
        data.forEach(img => {
          let url = typeof img === 'string' ? img : (img.url || img.src || '');
          if (url && isProductImage(url, null)) imageSet.add(convertToHDImage(url));
        });
      }
    });
    product.images = Array.from(imageSet).slice(0, CONFIG.maxImages);
    log(`✅ 高清图片：${product.images.length} 张`);

    // 商品ID
    const match = window.location.href.match(/-i(\d+)/);
    if (match) {
      product.itemId = match[1];
      log(`✅ 商品ID：${product.itemId}`);
    }

    // SKU ID（完整）
    const skuMatch = window.location.href.match(/skuId=([^&]+)/);
    if (skuMatch) {
      product.skuId = decodeURIComponent(skuMatch[1]);
    } else {
      const skuEl = document.querySelector('[data-sku-id], [data-skuid]');
      if (skuEl) product.skuId = skuEl.getAttribute('data-sku-id') || skuEl.getAttribute('data-skuid') || '';
      else {
        const skuData = extractDataFromScripts(['"skuId"\\s*:\\s*"([^"]+)"', '"simpleSku"\\s*:\\s*"([^"]+)"']);
        if (skuData.length > 0) product.skuId = skuData[0];
      }
    }
    log(`✅ SKU：${product.skuId}`);

    // 店铺名（过滤冗余信息）
    const shopEl = document.querySelector('.pdp-link a, [class*="seller-name"] a');
    if (shopEl) {
      product.shopName = shopEl.textContent.trim();
      if (product.shopName.includes('Seller Ratings')) {
        product.shopName = product.shopName.split('Seller Ratings')[0].trim();
      }
      log(`✅ 店铺：${product.shopName}`);
    }

    // 评分
    const ratingEl = document.querySelector('.pdp-review-summary__link, [class*="rating-number"]');
    if (ratingEl) {
      const m = ratingEl.textContent.match(/([\d.]+)/);
      if (m) {
        product.rating = parseFloat(m[1]);
        log(`✅ 评分：${product.rating}`);
      }
    }

    // 销量
    const soldEl = document.querySelector('[class*="review-count"], [class*="rating-count"]');
    if (soldEl) {
      const m = soldEl.textContent.match(/([\d,]+)/);
      if (m) {
        product.soldCount = parseInt(m[1].replace(/,/g, ''));
        log(`✅ 销量：${product.soldCount}`);
      }
    }

    // 规格参数
    const specContainer = document.querySelector('#product-specifications, [class*="specifications"]');
    if (specContainer) {
      specContainer.querySelectorAll('tr, li, .spec-item').forEach(row => {
        const cells = row.querySelectorAll('td, th, dt, dd');
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim();
          const value = cells[1].textContent.trim();
          if (label && value && label.length < 50) product.specifications[label] = value;
        }
      });
      log(`✅ 规格：${Object.keys(product.specifications).length} 项`);
    }

    // Variants（颜色/尺寸 + 每个的 sku/price/image）
    collectLazadaVariants(product);
  }

  // ---------- Lazada Variants ----------
  function collectLazadaVariants(product) {
    const variants = [];
    const skuGroups = document.querySelectorAll('[class*="sku-selection"], [class*="variation"]');

    skuGroups.forEach(group => {
      const propName = group.querySelector('[class*="title"], [class*="label"]')?.textContent?.trim();
      if (!propName) return;

      const variantGroup = { name: propName, options: [] };

      group.querySelectorAll('[class*="sku-value"], button').forEach(option => {
        const label = option.textContent?.trim() || option.getAttribute('title') || '';
        if (!label || label.length >= 50) return;

        const optionObj = { label };

        // SKU
        const sku = option.getAttribute('data-sku') || option.getAttribute('data-id');
        if (sku) optionObj.sku = sku;

        // 价格（每个变体独立价格）
        const price = option.getAttribute('data-price') || option.querySelector('[class*="price"]')?.textContent?.trim();
        if (price) optionObj.price = price;

        // 图片（每个变体对应的高清图）
        const img = option.querySelector('img');
        if (img) {
          const src = img.src || img.getAttribute('data-src') || '';
          if (isProductImage(src, img)) optionObj.image = convertToHDImage(src);
        }

        variantGroup.options.push(optionObj);
      });

      if (variantGroup.options.length > 0) {
        variants.push(variantGroup);
        log(`✅ 属性"${propName}"：${variantGroup.options.length} 个选项`);
        variantGroup.options.forEach(opt => {
          let info = `  - ${opt.label}`;
          if (opt.price) info += ` (${opt.price})`;
          if (opt.sku) info += ` [SKU:${opt.sku}]`;
          if (opt.image) info += ` [图:✓]`;
          log(info);
        });
      }
    });

    // 从 script 数据补充
    const skuData = extractDataFromScripts(['"skus"\\s*:\\s*(\\[[\\s\\S]*?\\])']);
    if (skuData.length > 0 && Array.isArray(skuData[0])) {
      log(`✅ 从script补充 ${skuData[0].length} 个SKU`);
      skuData[0].forEach(sku => {
        const skuLabel = sku.name || sku.skuLabel || '';
        variants.forEach(group => {
          group.options.forEach(option => {
            if (skuLabel.includes(option.label)) {
              if (sku.skuId && !option.sku) option.sku = sku.skuId;
              if (sku.price && !option.price) option.price = sku.price;
              if (sku.image && !option.image) option.image = convertToHDImage(sku.image);
            }
          });
        });
      });
    }

    product.variants = variants;
    log(`✅ Variants：${variants.length} 组`);
  }

  // ---------- Shopee ----------
  function collectShopee(product) {
    const titleEl = document.querySelector('h1, [class*="product-title"]');
    if (titleEl) product.title = titleEl.textContent.trim();

    const priceEl = document.querySelector('[class*="product-price"], [class*="price"]');
    if (priceEl) product.price = priceEl.textContent.trim();

    const descEl = document.querySelector('[class*="description"]');
    if (descEl) product.description = descEl.innerText.trim().replace(/If you want to report[\s\S]*/i, '').trim();

    const imageSet = new Set();
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && isProductImage(src, img)) imageSet.add(convertToHDImage(src));
    });
    product.images = Array.from(imageSet).slice(0, CONFIG.maxImages);

    const match = window.location.href.match(/i\.(\d+)/);
    if (match) product.itemId = match[1];

    const skuMatch = window.location.href.match(/sku_id=([^&]+)/);
    if (skuMatch) product.skuId = skuMatch[1];

    const shopEl = document.querySelector('[class*="shop-name"]');
    if (shopEl) product.shopName = shopEl.textContent.trim();

    const ratingEl = document.querySelector('[class*="rating"]');
    if (ratingEl) {
      const m = ratingEl.textContent.match(/([\d.]+)/);
      if (m) product.rating = parseFloat(m[1]);
    }

    const soldEl = document.querySelector('[class*="sold"]');
    if (soldEl) {
      const m = soldEl.textContent.match(/([\d.]+[Kk]?)/);
      if (m) {
        let count = m[1].replace(/[Kk]/, '');
        if (m[1].includes('K') || m[1].includes('k')) count = parseFloat(count) * 1000;
        product.soldCount = parseInt(count);
      }
    }

    document.querySelectorAll('[class*="specification"] tr').forEach(row => {
      const label = row.querySelector('td:first-child')?.textContent?.trim();
      const value = row.querySelector('td:last-child')?.textContent?.trim();
      if (label && value) product.specifications[label] = value;
    });

    // Shopee Variants
    const tierVars = document.querySelectorAll('[class*="tier-variation"]');
    tierVars.forEach(group => {
      const propName = group.querySelector('[class*="title"]')?.textContent?.trim();
      if (!propName) return;
      const variantGroup = { name: propName, options: [] };
      group.querySelectorAll('[class*="option"], button').forEach(option => {
        const label = option.textContent?.trim() || option.getAttribute('title') || '';
        if (label) {
          const optionObj = { label };
          const img = option.querySelector('img');
          if (img) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (isProductImage(src, img)) optionObj.image = convertToHDImage(src);
          }
          variantGroup.options.push(optionObj);
        }
      });
      if (variantGroup.options.length > 0) product.variants.push(variantGroup);
    });

    log(`✅ Shopee 采集完成`);
  }

  // ---------- 1688 ----------
  function collect1688(product) {
    const titleEl = document.querySelector('h1');
    if (titleEl) product.title = titleEl.textContent.trim();

    const priceEl = document.querySelector('[class*="price"]');
    if (priceEl) product.price = priceEl.textContent.trim();

    const descEl = document.querySelector('[class*="description"]');
    if (descEl) product.description = descEl.innerText.trim();

    const imageSet = new Set();
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && isProductImage(src, img)) imageSet.add(convertToHDImage(src));
    });
    product.images = Array.from(imageSet).slice(0, CONFIG.maxImages);

    const match = window.location.href.match(/offer\/(\d+)/);
    if (match) product.itemId = match[1];

    const shopEl = document.querySelector('[class*="company-name"]');
    if (shopEl) product.shopName = shopEl.textContent.trim();

    log(`✅ 1688 采集完成`);
  }

  // ═══════════════════════════════════════════════════════════
  // 【ERP 推送】
  // ═══════════════════════════════════════════════════════════

  async function pushToERP(product) {
    try {
      const response = await fetch(CONFIG.erpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CONFIG.erpToken,
        },
        body: JSON.stringify(product),
      });
      const result = await response.json();
      if (response.ok && result.code === 0) {
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message || `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 【主流程】采集 + 推送 + 自检
  // ═══════════════════════════════════════════════════════════

  async function doCollect() {
    log('━━━━━━━━━━━━━━━━━━');
    log('🔍 开始采集...');

    try {
      const product = collectProduct();
      STATS.total++;

      if (CONFIG.autoPush) {
        log('📡 推送到 ERP...');
        const result = await pushToERP(product);
        if (result.success) {
          log(`✅ 推送成功：${result.message}`, 'success');
          STATS.success++;
          // 保存本地备份
          const existing = JSON.parse(GM_getValue('collected_products', '[]'));
          existing.push(product);
          GM_setValue('collected_products', JSON.stringify(existing));
          showSummary(product, true);
        } else {
          log(`❌ 推送失败：${result.message}`, 'error');
          STATS.fail++;
          // 失败也保存本地
          const existing = JSON.parse(GM_getValue('collected_products', '[]'));
          existing.push(product);
          GM_setValue('collected_products', JSON.stringify(existing));
          showSummary(product, false, result.message);
        }
      } else {
        // 只保存本地
        const existing = JSON.parse(GM_getValue('collected_products', '[]'));
        existing.push(product);
        GM_setValue('collected_products', JSON.stringify(existing));
        STATS.success++;
        log('✅ 已保存到本地', 'success');
        showSummary(product, true);
      }
    } catch (error) {
      log(`❌ 错误：${error.message}`, 'error');
      STATS.fail++;
      STATS.total++;
      showSummary(null, false, error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 【自检提示】底部显示成功/失败统计
  // ═══════════════════════════════════════════════════════════

  function showSummary(product, success, errorMsg) {
    let msg = '';
    if (success && product) {
      msg = `✅ 采集成功！\n\n` +
            `标题：${product.title.substring(0, 30)}...\n` +
            `价格：${product.price}\n` +
            `高清图片：${product.images.length} 张\n` +
            `规格：${Object.keys(product.specifications).length} 项\n` +
            `Variants：${product.variants.length} 组\n` +
            `评分：${product.rating}\n` +
            `销量：${product.soldCount}\n\n` +
            `━━━━━━━━━━━━━━\n` +
            `📊 本次会话统计：\n` +
            `  成功：${STATS.success} 条\n` +
            `  失败：${STATS.fail} 条\n` +
            `  总计：${STATS.total} 条`;
    } else {
      msg = `❌ 采集失败：${errorMsg || '未知错误'}\n\n` +
            `━━━━━━━━━━━━━━\n` +
            `📊 本次会话统计：\n` +
            `  成功：${STATS.success} 条\n` +
            `  失败：${STATS.fail} 条\n` +
            `  总计：${STATS.total} 条`;
    }
    alert(msg);
  }

  // ═══════════════════════════════════════════════════════════
  // 【UI 初始化】
  // ═══════════════════════════════════════════════════════════

  function initUI() {
    // 调试面板
    const panel = document.createElement('div');
    panel.id = 'collector-panel';
    panel.innerHTML = '<h3>🔍 调试面板（v10.0）</h3>';
    document.body.appendChild(panel);

    // ⭐ 显示/隐藏按钮（解决验证码遮挡）
    let buttonsVisible = true;
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'collector-toggle';
    toggleBtn.textContent = '👁️ 隐藏按钮';
    toggleBtn.onclick = function () {
      buttonsVisible = !buttonsVisible;
      const mainBtn = document.getElementById('collector-main-btn');
      const debugBtn = document.getElementById('collector-debug-btn');
      if (buttonsVisible) {
        mainBtn.classList.remove('cl-hidden');
        debugBtn.classList.remove('cl-hidden');
        toggleBtn.textContent = '👁️ 隐藏按钮';
      } else {
        mainBtn.classList.add('cl-hidden');
        debugBtn.classList.add('cl-hidden');
        toggleBtn.textContent = '👁️ 显示按钮';
      }
      log(buttonsVisible ? '✅ 按钮已显示' : '✅ 按钮已隐藏');
    };
    document.body.appendChild(toggleBtn);

    // 主采集按钮
    const mainBtn = document.createElement('button');
    mainBtn.id = 'collector-main-btn';
    mainBtn.textContent = '🔗 采集全部信息';
    mainBtn.onclick = async function () {
      mainBtn.disabled = true;
      mainBtn.style.opacity = '0.7';
      mainBtn.textContent = '⏳ 采集中...';
      await doCollect();
      setTimeout(() => {
        mainBtn.disabled = false;
        mainBtn.style.opacity = '1';
        mainBtn.textContent = '🔗 采集全部信息';
      }, 2000);
    };
    document.body.appendChild(mainBtn);

    // 调试面板开关
    const debugBtn = document.createElement('button');
    debugBtn.id = 'collector-debug-btn';
    debugBtn.textContent = '🔍 调试面板';
    debugBtn.onclick = function () {
      panel.classList.toggle('show');
    };
    document.body.appendChild(debugBtn);

    log('🔗 采集器 v10.0 已加载');
    log(`📡 ERP：${CONFIG.erpUrl}`);
    log(`🔑 Token：${CONFIG.erpToken.substring(0, 10)}...`);
    log('💡 左上角"隐藏按钮"可隐藏采集按钮（验证码用）');
    log('✅ 就绪，点击"采集全部信息"');
  }

  // ═══════════════════════════════════════════════════════════
  // 【启动】
  // ═══════════════════════════════════════════════════════════

  if (document.readyState === 'complete') {
    setTimeout(initUI, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(initUI, 1000));
  }
})();
