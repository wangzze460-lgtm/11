import { useState } from 'react';
import { X, ExternalLink, Copy, CheckCircle, Image as ImageIcon, Tag, ShoppingBag, Star, Package } from 'lucide-react';
import { ProductInfo } from '../utils/linkParser';

interface ProductDetailProps {
  product: ProductInfo;
  onClose: () => void;
}

export default function ProductDetail({ product, onClose }: ProductDetailProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState(0);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              product.platform === 'shopee' 
                ? 'bg-orange-100 text-orange-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {product.platform === 'shopee' ? '🟠 Shopee' : '🔵 Lazada'}
            </span>
            <span className="text-sm text-gray-500">
              采集于 {new Date(product.collectedAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Images */}
          {product.images && product.images.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                  <img
                    src={product.images[currentImage]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E图片加载失败%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {product.images.slice(0, 5).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          currentImage === idx ? 'border-blue-500' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">
                    {product.title || '无标题'}
                  </h2>
                  <div className="flex items-baseline gap-2">
                    {product.price && (
                      <span className="text-2xl font-bold text-red-500">
                        {product.price}
                      </span>
                    )}
                    {product.originalPrice && (
                      <span className="text-sm text-gray-400 line-through">
                        {product.originalPrice}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {product.rating && (
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      <span>{product.rating}</span>
                    </div>
                  )}
                  {product.soldCount && (
                    <div className="flex items-center gap-1">
                      <ShoppingBag size={16} />
                      <span>已售 {product.soldCount}</span>
                    </div>
                  )}
                </div>

                {/* Shop Info */}
                {product.shopName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">店铺</p>
                    <p className="font-medium text-gray-800">{product.shopName}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <ExternalLink size={16} />
                    查看原文
                  </a>
                  <button
                    onClick={() => copyText(product.url, 'url')}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied === 'url' ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied === 'url' ? '已复制' : '复制链接'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No Images Layout */}
          {(!product.images || product.images.length === 0) && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {product.title || '无标题'}
              </h2>
              <div className="flex items-baseline gap-2 mb-4">
                {product.price && (
                  <span className="text-2xl font-bold text-red-500">
                    {product.price}
                  </span>
                )}
                {product.originalPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {product.originalPrice}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <ExternalLink size={16} />
                  查看原文
                </a>
                <button
                  onClick={() => copyText(product.url, 'url')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  {copied === 'url' ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copied === 'url' ? '已复制' : '复制链接'}
                </button>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Package size={18} />
                商品描述
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {product.description}
              </div>
            </div>
          )}

          {/* Specifications */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Tag size={18} />
                规格参数
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-200 last:border-b-0">
                        <td className="px-4 py-2 bg-gray-100 font-medium text-gray-700 w-32">
                          {key}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Package size={18} />
                商品规格
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {product.variants.map((variant, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{variant.name}</span>
                    <div className="flex items-center gap-3">
                      {variant.price && (
                        <span className="text-sm font-medium text-red-500">{variant.price}</span>
                      )}
                      {variant.stock !== undefined && (
                        <span className="text-xs text-gray-500">库存: {variant.stock}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product IDs */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">商品信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {product.itemId && (
                <div>
                  <span className="text-blue-600">商品ID:</span>
                  <span className="ml-2 text-gray-700 font-mono">{product.itemId}</span>
                </div>
              )}
              {product.shopId && (
                <div>
                  <span className="text-blue-600">店铺ID:</span>
                  <span className="ml-2 text-gray-700 font-mono">{product.shopId}</span>
                </div>
              )}
              {product.skuId && (
                <div>
                  <span className="text-blue-600">SKU ID:</span>
                  <span className="ml-2 text-gray-700 font-mono">{product.skuId}</span>
                </div>
              )}
              {product.category && (
                <div>
                  <span className="text-blue-600">分类:</span>
                  <span className="ml-2 text-gray-700">{product.category}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
