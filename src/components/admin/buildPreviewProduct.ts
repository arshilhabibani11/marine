import { fromLocalInputValue } from '../../lib/utils'
import type { Product } from '../../types'
import type { ProductFormData } from '../../hooks/useProductForm'

/**
 * Build a storefront-shaped Product from the current form state so the real
 * ProductCard can be rendered — a true WYSIWYG preview of the listing
 * (image, sale badge, countdown, price, stock, custom label).
 */
export function buildPreviewProduct(
  form: ProductFormData,
  brandList: { id: string; name: string }[],
): Product {
  const regularPrice = Number(form.regularPrice) || 0
  const salePrice = form.salePrice ? Number(form.salePrice) : undefined
  const start = form.saleStartsAt ? new Date(fromLocalInputValue(form.saleStartsAt)).getTime() : -Infinity
  const end = form.saleEndsAt ? new Date(fromLocalInputValue(form.saleEndsAt)).getTime() : Infinity
  const now = Date.now()
  const isOnSale =
    Boolean(salePrice) &&
    salePrice != null &&
    salePrice > 0 &&
    regularPrice > salePrice &&
    now >= start &&
    now <= end

  const brandName = brandList.find((b) => b.id === form.brand)?.name || form.brand || 'Brand'

  return {
    id: 'preview-product',
    filename: form.images.find((img) => img.url)?.url || '',
    name: form.name || 'Product name',
    brand: brandName,
    sku: form.sku || 'SKU',
    category: 'spares' as Product['category'],
    industry: [],
    availability: form.availability as Product['availability'],
    specs: Object.fromEntries(
      form.specs.filter((s) => s.name.trim()).map((s) => [s.name, s.value]),
    ),
    description: form.description || form.shortDescription || '',
    condition: form.condition as Product['condition'],
    price: isOnSale && salePrice ? salePrice : regularPrice,
    regularPrice: regularPrice || undefined,
    salePrice: isOnSale ? salePrice : undefined,
    onSale: isOnSale,
    saleStartsAt: isOnSale && form.saleStartsAt ? fromLocalInputValue(form.saleStartsAt) : undefined,
    saleEndsAt: isOnSale && form.saleEndsAt ? fromLocalInputValue(form.saleEndsAt) : undefined,
    inStock: form.availability !== 'out-of-stock' && (Number(form.stockCount) || 0) > 0,
    stockCount: Number(form.stockCount) || 0,
    customLabel: form.customLabel || undefined,
    customLabelColor: form.customLabel ? form.customLabelColor : undefined,
    images: [],
    makeOffer: form.makeOfferEnabled,
  }
}