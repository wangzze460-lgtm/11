export function generateDoubaoPrompt(erpInfo: {
  techStack?: string;
  database?: string;
  hasApi?: boolean;
}) {
  const { techStack = '不确定', database = 'MySQL', hasApi = false } = erpInfo;

  return `# 需求：添加商品链接采集接收接口

## 背景
我在使用一个 Shopee/Lazada 链接采集工具，采集到的商品链接需要自动推送到我们的 ERP 系统。

## 需求
请帮我写一个 API 接口，用于接收采集工具推送的商品数据。

## 接口要求

### 基本信息
- 请求方式：POST
- 接口路径：/api/products/collect
- Content-Type：application/json
- 认证方式：Bearer Token（生成一个固定的 Token）

### 接收的数据格式
\`\`\`json
{
  "url": "商品完整链接",
  "platform": "shopee 或 lazada",
  "itemId": "商品ID",
  "shopId": "店铺ID",
  "title": "商品标题",
  "price": "价格",
  "skuId": "SKU ID",
  "collectedAt": "采集时间 ISO8601格式"
}
\`\`\`

### 示例请求
\`\`\`bash
curl -X POST http://localhost:3000/api/products/collect \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "url": "https://shopee.sg/product/xxx",
    "platform": "shopee",
    "itemId": "123456",
    "shopId": "789",
    "title": "测试商品",
    "price": "99.00",
    "skuId": "001",
    "collectedAt": "2025-01-01T00:00:00.000Z"
  }'
\`\`\`

### 期望响应
\`\`\`json
{
  "code": 0,
  "message": "success",
   {
    "id": "保存后的记录ID"
  }
}
\`\`\`

## 实现要求

1. **创建数据库表**（如果还没有的话）
   - 表名：collected_products
   - 字段：id, url, platform, item_id, shop_id, title, price, sku_id, collected_at, created_at
   - 添加索引：platform, item_id

2. **编写接口代码**
   - 接收 JSON 数据
   - 验证必填字段（url, platform）
   - 保存到数据库
   - 返回成功响应

3. **添加认证**
   - 生成一个固定的 Bearer Token
   - 在接口中验证 Token
   - Token 错误时返回 401

4. **错误处理**
   - 参数错误返回 400
   - 认证失败返回 401
   - 服务器错误返回 500

## 技术栈
${techStack === '不确定' ? '请使用你熟悉的技术栈（推荐 Node.js + Express 或 Python + Flask）' : techStack}

## 数据库
${database}

## 额外要求
- 代码要有注释
- 提供完整的代码文件
- 告诉我如何测试这个接口
- 告诉我接口部署后的完整 URL 是什么

## 完成后请告诉我
1. 接口的完整 URL（例如：https://your-domain.com/api/products/collect）
2. Bearer Token 是什么
3. 如何测试这个接口

谢谢！`;
}

export function generateSimplePrompt() {
  return `# 简单需求：添加商品接收接口

请帮我写一个简单的 API 接口，用于接收商品数据。

## 接口信息
- 路径：POST /api/products/collect
- 格式：JSON
- 认证：Bearer Token

## 接收字段
- url: 商品链接（必填）
- platform: 平台 shopee/lazada（必填）
- itemId: 商品ID
- shopId: 店铺ID
- title: 标题
- price: 价格
- skuId: SKU ID
- collectedAt: 采集时间

## 示例
\`\`\`json
{
  "url": "https://shopee.sg/product/xxx",
  "platform": "shopee",
  "itemId": "123456",
  "title": "商品标题"
}
\`\`\`

## 要求
1. 保存到数据库
2. 返回 {"code": 0, "message": "success"}
3. 添加 Bearer Token 认证
4. 告诉我接口地址和 Token

谢谢！`;
}
