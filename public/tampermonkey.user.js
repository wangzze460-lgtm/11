// ==UserScript==
// @name         商品采集器（定制版）
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  按要求采集完整商品信息
// @match        *://*.lazada.co.th/*
// @match        *://*.lazada.sg/*
// @match        *://*.lazada.com.my/*
// @match        *://*.lazada.vn/*
// @match        *://*.lazada.com.ph/*
// @match        *://*.lazada.co.id/*
// @match        *://*.shopee.sg/*
// @match        *://*.shopee.com.my/*
// @match        *://*.shopee.co.th/*
// @match        *://*.shopee.vn/*
// @match        *://*.shopee.ph/*
// @match        *://*.shopee.co.id/*
// @match        *://*.shopee.tw/*
// @match        *://*.shopee.com.br/*
// @match        *://*.1688.com/*
// @match        *://detail.1688.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const DEFAULT_CONFIG = {
        erpUrl: 'https://erp.zancuren.com/api/products/collect',
        erpToken: '11a95ccfc9050ba877815d125585d502'
    };
    
    function getConfig() {
        const saved = GM_getValue('user_config', null);
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    }
    
    function saveConfig(config) {
        GM_setValue('user_config', JSON.stringify(config));
    }
    
    function convertToOriginalImage(url) {
        if (!url) return url;
        url = url.replace(/_\d+x\d+\.jpg/g, '.jpg');
        url = url.replace(/_\d+x\d+\.png/g, '.png');
        url = url.replace(/_\d+x\d+\.webp/g, '.webp');
        url = url.split('?')[0];
        return url;
    }
    
    function isProductImage(url, img) {
        if (!url || !url.startsWith('http')) return false;
        
        const excludeKeywords = [
            'icon', 'logo', 'sprite', 'avatar', 'badge', 'flag',
            'banner', 'ad-', 'ads/', 'promotion', 'coupon',
            'rating-star', 'star-empty', 'star-full',
            'loading', 'placeholder', 'default',
            'payment', 'shipping', 'delivery',
            'chat', 'message', 'notification',
            'facebook', 'twitter', 'instagram', 'line',
            'app-store', 'google-play', 'qr-code'
        ];
        
        const urlLower = url.toLowerCase();
        for (let keyword of excludeKeywords) {
            if (urlLower.includes(keyword)) return false;
        }
        
        if (img) {
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            if (width > 0 && height > 0 && (width < 200 || height < 200)) {
                return false;
            }
        }
        
        const includeKeywords = [
            'lazada', 'lzd', 'alicdn', 'shopee', '1688',
            'product', 'gallery', 'pdp', 'item',
            'cf.shopee', 'sg-live', 'my-live', 'th-live'
        ];
        
        for (let keyword of includeKeywords) {
            if (urlLower.includes(keyword)) return true;
        }
        
        if (img) {
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            if (width > 400 && height > 400) return true;
        }
        
        return false;
    }
    
    GM_addStyle(`
        #config-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:9999999999;padding:30px;display:none}
        #config-panel.show{display:block}
        #config-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999999998;display:none}
        #config-overlay.show{display:block}
        .config-title{font-size:20px;font-weight:bold;margin-bottom:20px}
        .config-field{margin-bottom:16px}
        .config-label{display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#555}
        .config-input{width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;box-sizing:border-box}
        .config-input:focus{outline:none;border-color:#ff6600}
        .config-buttons{display:flex;gap:10px;margin-top:20px}
        .config-btn{flex:1;padding:12px;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
        .config-btn-save{background:linear-gradient(135deg,#ff6600,#ff8800);color:white}
        .config-btn-cancel{background:#f0f0f0;color:#666}
    `);
    
    function detectPlatform() {
        const url = window.location.href;
        if (url.includes('lazada')) return 'lazada';
        if (url.includes('shopee')) return 'shopee';
        if (url.includes('1688')) return '1688';
        return 'unknown';
    }
    
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
                            const data = JSON.parse(match[1]);
                            results.push(data);
                        } catch(e) {}
                    }
                }
            }
        } catch(e) {}
        return results;
    }
    
    function collectProduct() {
        const platform = detectPlatform();
        const product = {
            url: window.location.href,
            platform: platform,
            site: window.location.hostname,
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
            collectedAt: new Date().toISOString()
        };
        
        if (platform === 'lazada') collectLazada(product);
        else if (platform === 'shopee') collectShopee(product);
        else if (platform === '1688') collect1688(product);
        
        return product;
    }
    
    function collectLazada(product) {
        console.log('🔍 开始采集 Lazada...');
        
        const titleEl = document.querySelector('h1, [class*="pdp-product-title"]');
        if (titleEl) product.title = titleEl.textContent.trim();
        
        const priceEl = document.querySelector('[class*="pdp-price"], [class*="product-price"]');
        if (priceEl) product.price = priceEl.textContent.trim();
        
        const origEl = document.querySelector('[class*="pdp-original-price"], [class*="original-price"]');
        if (origEl) product.originalPrice = origEl.textContent.trim();
        
        // rating
        const ratingSelectors = [
            '[class*="pdp-review-summary"] [class*="number"]',
            '[class*="rating"] [class*="number"]',
            '[class*="review"] [class*="rating"]',
            '.pdp-review-summary__link'
        ];
        
        for (let selector of ratingSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
                const match = text.match(/([\d.]+)/);
                if (match) {
                    product.rating = parseFloat(match[1]);
                    console.log(`⭐ 评分：${product.rating}`);
                    break;
                }
            }
        }
        
        if (product.rating === 0) {
            const ratingData = extractDataFromScripts([
                '"rating"\\s*:\\s*([\\d.]+)',
                '"averageRating"\\s*:\\s*([\\d.]+)'
            ]);
            if (ratingData.length > 0) {
                product.rating = parseFloat(ratingData[0]);
            }
        }
        
        // soldCount
        const reviewSelectors = [
            '[class*="pdp-review-summary"] [class*="count"]',
            '[class*="review-count"]',
            '[class*="rating-count"]'
        ];
        
        for (let selector of reviewSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
                const match = text.match(/([\d,]+)/);
                if (match) {
                    product.soldCount = parseInt(match[1].replace(/,/g, ''));
                    console.log(`📊 评价/销量：${product.soldCount}`);
                    break;
                }
            }
        }
        
        // description
        const descSelectors = [
            '[class*="pdp-product-description"]',
            '[class*="product-description"]',
            '#product-description',
            '[class*="product-details"]',
            '[class*="highlights"]'
        ];
        
        for (let selector of descSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                let desc = el.innerText.trim();
                desc = desc.replace(/If you want to report an issue[\s\S]*/i, '').trim();
                desc = desc.replace(/Report this product[\s\S]*/i, '').trim();
                desc = desc.replace(/Copyright[\s\S]*/i, '').trim();
                
                if (desc.length > 50) {
                    product.description = desc;
                    console.log(`📝 描述：${desc.length} 字符`);
                    break;
                }
            }
        }
        
        // images
        const imageSet = new Set();
        document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
            if (isProductImage(src, img)) {
                imageSet.add(convertToOriginalImage(src));
            }
        });
        
        const imgData = extractDataFromScripts([
            '"images"\\s*:\\s*(\\[[\\s\\S]*?\\])',
            '"gallery"\\s*:\\s*(\\[[\\s\\S]*?\\])'
        ]);
        imgData.forEach(data => {
            if (Array.isArray(data)) {
                data.forEach(img => {
                    let url = typeof img === 'string' ? img : (img.url || img.src || '');
                    if (isProductImage(url, null)) {
                        imageSet.add(convertToOriginalImage(url));
                    }
                });
            }
        });
        
        product.images = Array.from(imageSet).slice(0, 20);
        console.log(`📸 图片：${product.images.length} 张`);
        
        // itemId
        const match = window.location.href.match(/-i(\d+)/) || window.location.href.match(/i(\d+)/);
        if (match) product.itemId = match[1];
        
        // skuId (完整)
        const skuMatch = window.location.href.match(/skuId=([^&]+)/);
        if (skuMatch) {
            product.skuId = decodeURIComponent(skuMatch[1]);
        }
        
        if (!product.skuId) {
            const skuEl = document.querySelector('[data-sku-id], [data-skuid]');
            if (skuEl) {
                product.skuId = skuEl.getAttribute('data-sku-id') || skuEl.getAttribute('data-skuid') || '';
            }
        }
        
        if (!product.skuId) {
            const skuData = extractDataFromScripts([
                '"skuId"\\s*:\\s*"([^"]+)"',
                '"simpleSku"\\s*:\\s*"([^"]+)"'
            ]);
            if (skuData.length > 0) product.skuId = skuData[0];
        }
        
        console.log(`🔖 SKU ID：${product.skuId}`);
        
        // shopName
        const shopEl = document.querySelector('[class*="seller-name"], [class*="pdp-link"]');
        if (shopEl) product.shopName = shopEl.textContent.trim();
        
        // specifications
        const specContainer = document.querySelector('[class*="specifications"], [class*="product-spec"], #specifications');
        if (specContainer) {
            specContainer.querySelectorAll('tr, li, [class*="spec-item"]').forEach(row => {
                const cells = row.querySelectorAll('td, th, dt, dd');
                if (cells.length >= 2) {
                    const label = cells[0].textContent.trim();
                    const value = cells[1].textContent.trim();
                    if (label && value && label.length < 50) {
                        product.specifications[label] = value;
                    }
                }
            });
        }
        
        const specData = extractDataFromScripts([
            '"specifications"\\s*:\\s*(\\{[\\s\\S]*?\\})'
        ]);
        specData.forEach(data => {
            if (typeof data === 'object') {
                Object.assign(product.specifications, data);
            }
        });
        
        console.log(`📋 规格：${Object.keys(product.specifications).length} 项`);
        
        // variants
        collectLazadaVariants(product);
    }
    
    function collectLazadaVariants(product) {
        console.log('🎨 开始采集 variants...');
        
        const variants = [];
        
        const skuGroups = document.querySelectorAll(
            '[class*="sku-selection"], [class*="variation"], [class*="sku-prop"]'
        );
        
        skuGroups.forEach(group => {
            const propName = group.querySelector('[class*="title"], [class*="label"], [class*="name"]')?.textContent?.trim();
            if (!propName) return;
            
            const variantGroup = { name: propName, options: [] };
            
            group.querySelectorAll('[class*="sku-value"], [class*="variant"], button, [class*="option"]').forEach(option => {
                const label = option.textContent?.trim() || option.getAttribute('title') || option.getAttribute('aria-label') || '';
                
                if (label && label.length < 50) {
                    const optionObj = { label: label };
                    
                    const sku = option.getAttribute('data-sku') || option.getAttribute('data-id') || option.getAttribute('data-value');
                    if (sku) optionObj.sku = sku;
                    
                    const price = option.getAttribute('data-price');
                    if (price) optionObj.price = price;
                    
                    const img = option.querySelector('img');
                    if (img) {
                        const src = img.src || img.getAttribute('data-src') || '';
                        if (isProductImage(src, img)) {
                            optionObj.image = convertToOriginalImage(src);
                        }
                    }
                    
                    variantGroup.options.push(optionObj);
                }
            });
            
            if (variantGroup.options.length > 0) {
                variants.push(variantGroup);
                console.log(`  📦 ${propName}: ${variantGroup.options.length} 个选项`);
            }
        });
        
        const skuData = extractDataFromScripts([
            '"skus"\\s*:\\s*(\\[[\\s\\S]*?\\])'
        ]);
        
        if (skuData.length > 0 && Array.isArray(skuData[0])) {
            skuData[0].forEach(sku => {
                const skuLabel = sku.name || sku.skuLabel || '';
                const skuId = sku.skuId || sku.id || '';
                const price = sku.price || sku.promotedPrice || '';
                const image = sku.image || '';
                
                variants.forEach(group => {
                    group.options.forEach(option => {
                        if (skuLabel.includes(option.label)) {
                            if (skuId) option.sku = skuId;
                            if (price) option.price = price;
                            if (image && isProductImage(image, null)) {
                                option.image = convertToOriginalImage(image);
                            }
                        }
                    });
                });
            });
        }
        
        product.variants = variants;
        console.log(`✅ variants 采集完成：${variants.length} 组`);
    }
    
    function collectShopee(product) {
        const titleEl = document.querySelector('h1, [class*="product-title"]');
        if (titleEl) product.title = titleEl.textContent.trim();
        
        const priceEl = document.querySelector('[class*="product-price"], [class*="price"]');
        if (priceEl) product.price = priceEl.textContent.trim();
        
        const ratingEl = document.querySelector('[class*="rating"]');
        if (ratingEl) {
            const m = ratingEl.textContent.match(/([\d.]+)/);
            if (m) product.rating = parseFloat(m[1]);
        }
        
        const soldEl = document.querySelector('[class*="sold"], [class*="sales"]');
        if (soldEl) {
            const m = soldEl.textContent.match(/([\d.]+[Kk]?)/);
            if (m) {
                let count = m[1].replace(/[Kk]/, '');
                if (m[1].includes('K') || m[1].includes('k')) count = parseFloat(count) * 1000;
                product.soldCount = parseInt(count);
            }
        }
        
        const descEl = document.querySelector('[class*="description"]');
        if (descEl) {
            product.description = descEl.innerText.trim().replace(/If you want to report[\s\S]*/i, '').trim();
        }
        
        const imageSet = new Set();
        document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src');
            if (isProductImage(src, img)) imageSet.add(convertToOriginalImage(src));
        });
        product.images = Array.from(imageSet).slice(0, 20);
        
        const match = window.location.href.match(/i\.(\d+)/);
        if (match) product.itemId = match[1];
        
        const skuMatch = window.location.href.match(/sku_id=([^&]+)/);
        if (skuMatch) product.skuId = skuMatch[1];
        
        const shopEl = document.querySelector('[class*="shop-name"]');
        if (shopEl) product.shopName = shopEl.textContent.trim();
        
        document.querySelectorAll('[class*="specification"] tr').forEach(row => {
            const label = row.querySelector('td:first-child')?.textContent?.trim();
            const value = row.querySelector('td:last-child')?.textContent?.trim();
            if (label && value) product.specifications[label] = value;
        });
    }
    
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
            if (isProductImage(src, img)) imageSet.add(convertToOriginalImage(src));
        });
        product.images = Array.from(imageSet).slice(0, 20);
        
        const match = window.location.href.match(/offer\/(\d+)/);
        if (match) product.itemId = match[1];
        
        const shopEl = document.querySelector('[class*="company-name"]');
        if (shopEl) product.shopName = shopEl.textContent.trim();
    }
    
    function createConfigPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'config-overlay';
        const panel = document.createElement('div');
        panel.id = 'config-panel';
        panel.innerHTML = `
            <div class="config-title">⚙️ 采集器配置</div>
            <div class="config-field">
                <label class="config-label">ERP 接口地址</label>
                <input type="text" id="config-erp-url" class="config-input">
            </div>
            <div class="config-field">
                <label class="config-label">ERP Token</label>
                <input type="text" id="config-erp-token" class="config-input">
            </div>
            <div class="config-buttons">
                <button class="config-btn config-btn-cancel" id="config-cancel">取消</button>
                <button class="config-btn config-btn-save" id="config-save">保存配置</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
        
        document.getElementById('config-cancel').onclick = () => {
            overlay.classList.remove('show');
            panel.classList.remove('show');
        };
        document.getElementById('config-save').onclick = () => {
            const url = document.getElementById('config-erp-url').value.trim();
            const token = document.getElementById('config-erp-token').value.trim();
            if (!url || !token) { alert('请填写完整'); return; }
            saveConfig({ erpUrl: url, erpToken: token });
            alert('✓ 配置已保存！');
            overlay.classList.remove('show');
            panel.classList.remove('show');
        };
    }
    
    function showConfigPanel() {
        const config = getConfig();
        document.getElementById('config-erp-url').value = config.erpUrl;
        document.getElementById('config-erp-token').value = config.erpToken;
        document.getElementById('config-overlay').classList.add('show');
        document.getElementById('config-panel').classList.add('show');
    }
    
    function init() {
        const config = getConfig();
        
        const btn = document.createElement('button');
        btn.textContent = '🔗 采集全部信息';
        btn.style.cssText = 'position:fixed!important;top:150px!important;right:30px!important;padding:20px 30px!important;background:linear-gradient(135deg,#ff6600,#ff8800)!important;color:white!important;border:3px solid white!important;border-radius:12px!important;font-size:18px!important;font-weight:bold!important;cursor:pointer!important;z-index:999999999!important;box-shadow:0 8px 24px rgba(255,102,0,0.4)!important;';
        
        btn.onclick = async function() {
            const originalText = btn.textContent;
            btn.textContent = '⏳ 采集中...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            
            let product = null;
            
            try {
                product = collectProduct();
                console.log('📦 完整数据：', product);
                
                btn.textContent = '⏳ 推送中...';
                
                const response = await fetch(config.erpUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + config.erpToken
                    },
                    body: JSON.stringify(product)
                });
                
                const result = await response.json();
                
                if (response.ok && result.code === 0) {
                    const existing = JSON.parse(GM_getValue('lazada_products', '[]'));
                    existing.push(product);
                    GM_setValue('lazada_products', JSON.stringify(existing));
                    
                    btn.textContent = '✓ 成功';
                    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    
                    alert('✓ 采集成功！\n\n评分：' + product.rating + '\n销量：' + product.soldCount + '\n规格：' + Object.keys(product.specifications).length + ' 项\nvariants：' + product.variants.length + ' 组\nSKU ID：' + (product.skuId || '无') + '\n图片：' + product.images.length + ' 张\n\n已保存到 ERP');
                } else {
                    throw new Error(result.message || 'HTTP ' + response.status);
                }
            } catch (error) {
                console.error('❌ 错误：', error);
                
                if (product) {
                    const existing = JSON.parse(GM_getValue('lazada_products', '[]'));
                    existing.push(product);
                    GM_setValue('lazada_products', JSON.stringify(existing));
                }
                
                btn.textContent = '❌ 失败';
                btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                alert('❌ 失败：' + error.message);
            }
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = 'linear-gradient(135deg, #ff6600, #ff8800)';
                btn.disabled = false;
                btn.style.opacity = '1';
            }, 2000);
        };
        
        document.body.appendChild(btn);
        
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙️ 设置';
        settingsBtn.style.cssText = 'position:fixed!important;top:240px!important;right:30px!important;padding:15px 25px!important;background:linear-gradient(135deg,#6366f1,#8b5cf6)!important;color:white!important;border:3px solid white!important;border-radius:12px!important;font-size:16px!important;font-weight:bold!important;cursor:pointer!important;z-index:999999999!important;';
        settingsBtn.onclick = showConfigPanel;
        document.body.appendChild(settingsBtn);
        
        createConfigPanel();
        
        console.log('🔗 采集器 v9.0 已加载（定制版）');
    }
    
    if (document.readyState === 'complete') {
        setTimeout(init, 1000);
    } else {
        window.addEventListener('load', () => setTimeout(init, 1000));
    }
})();
