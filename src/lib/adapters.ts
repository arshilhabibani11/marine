/**
 * Adapters to transform backend API responses into the frontend Product type.
 * This bridges the shape mismatch between Prisma model output and the
 * existing frontend Product interface.
 */
import type { Product } from '../types'

interface ApiProduct {
  id: string
  name: string
  sku: string
  slug: string
  brand?: { id: string; name: string; slug: string } | null
  category?: { id: string; name: string; slug: string; icon?: string } | null
  status: string
  availability: string
  condition: string
  shortDescription?: string | null
  description?: string | null
  regularPrice: number | string
  salePrice?: number | string | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  currency: string
  showPrice: boolean
  makeOfferEnabled: boolean
  stockCount: number
  lowStockThreshold: number
  warehouseLocation?: string | null
  publicItemLocation?: string | null
  leadTime?: string | null
  isNewArrival: boolean
  isFeatured: boolean
  customLabel?: string | null
  customLabelColor?: string | null
  sortPriority: number
  images: { id: string; url: string; altText?: string | null; label?: string | null; isMain: boolean; sortOrder: number }[]
  specs: { name: string; value: string }[]
  industries: { industry: { id: string; name: string; slug: string } }[]
  price?: number
  onSale?: boolean
  inStock?: boolean
  keyFeatures?: string[]
  compatibilityNotes?: string | null
  conditionNotes?: string | null
  warrantyNotes?: string | null
  includedItems?: string[]
  excludedItems?: string[]
  legacyId?: string | null
}

export function apiProductToFrontend(api: ApiProduct): Product {
  const regularPrice = Number(api.regularPrice) || 0
  const salePriceNum = api.salePrice ? Number(api.salePrice) : undefined
  const now = new Date()
  const isOnSale =
    salePriceNum != null &&
    salePriceNum < regularPrice &&
    (!api.saleStartsAt || new Date(api.saleStartsAt) <= now) &&
    (!api.saleEndsAt || new Date(api.saleEndsAt) >= now)

  const effectivePrice = isOnSale && salePriceNum ? salePriceNum : regularPrice

  // Product images uploaded from admin are full Cloudinary URLs. Keep those
  // URLs intact: converting them to the retired product-### filename scheme
  // makes the storefront request a non-existent local/static image instead.
  // Prefer the explicitly marked main image, then the first ordered image.
  const mainImage = api.images?.find((img) => img.isMain && img.url)?.url
  const primaryImageUrl = mainImage || api.images?.find((img) => img.url)?.url

  let filename = primaryImageUrl
  if (!filename) {
    // Legacy products without an image relation still use the historical
    // deterministic local/Cloudinary filename mapping.
    // Fallback: extract deterministic number from last 3 hex digits of UUID -> range 1-100
    const idDigits = api.id.replace(/[^a-f0-9]/gi, '').slice(-3)
    const parsed = parseInt(idDigits, 16)
    if (!isNaN(parsed)) {
      const num = String((parsed % 100) + 1).padStart(3, '0')
      filename = `products/product-${num}.jpg`
      console.warn(`[Image Fallback] Product ${api.id} (${api.sku}): no image URL, mapped to ${filename}`)
    } else {
      // Last resort: try SKU digits
      const skuMatch = api.sku.match(/(\d+)/)
      if (skuMatch) {
        const num = String((parseInt(skuMatch[1], 10) % 100) + 1).padStart(3, '0')
        filename = `products/product-${num}.jpg`
        console.warn(`[Image Fallback] Product ${api.id} (${api.sku}): no image URL, mapped from SKU to ${filename}`)
      } else {
        filename = 'products/placeholder.jpg'
        console.warn(`[Image Fallback] Product ${api.id} (${api.sku}): no valid image URL or SKU digits, using placeholder`)
      }
    }
  }

  return {
    id: api.id,
    filename,
    name: api.name,
    brand: api.brand?.name || 'Unknown',
    sku: api.sku,
    category: (api.category?.slug || 'other-business') as Product['category'],
    industry: api.industries?.map((i) => i.industry.slug) || [],
    availability: api.availability as Product['availability'],
    specs: Object.fromEntries(api.specs?.map((s) => [s.name, s.value]) || []),
    description: api.description || api.shortDescription || '',
    condition: api.condition as Product['condition'],
    price: effectivePrice,
    regularPrice: api.regularPrice != null ? Number(api.regularPrice) : undefined,
    salePrice: isOnSale ? salePriceNum : undefined,
    onSale: isOnSale,
    saleStartsAt: api.saleStartsAt || undefined,
    saleEndsAt: api.saleEndsAt || undefined,
    inStock: api.stockCount > 0,
    stockCount: api.stockCount,
    customLabel: api.customLabel || undefined,
    customLabelColor: api.customLabelColor || undefined,
    images: api.images?.length
      ? api.images.map((img) => ({
          url: img.url,
          alt: img.altText || `${api.name} - ${img.label || 'View'}`,
          label: img.label || undefined,
        }))
      : [{ url: `/images/${filename}`, alt: api.name }],
    isNewArrival: api.isNewArrival,
    makeOffer: api.makeOfferEnabled,
  }
}

export function apiProductsToFrontend(apiProducts: ApiProduct[]): Product[] {
  return apiProducts.map(apiProductToFrontend)
}
