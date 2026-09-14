import { prisma } from '../server.js'
import { generateSlug } from '../utils/helpers.js'
import { productAdminInclude } from '../utils/prisma-helpers.js'
import { logAudit } from '../utils/audit.js'
import type { AuthUser } from '../middleware/auth.js'

// ─── Helpers ──────────────────────────────────────────────────

function validateId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw Object.assign(new Error('Invalid product ID format'), { status: 400 })
  }
}

/**
 * Preserve the media-library relationship for Cloudinary assets selected in a
 * product form. The URL remains the rendering source, while the relation
 * prevents the media library from deleting an asset still used by a product.
 * Manually entered external URLs intentionally remain unlinked.
 */
async function createProductImage(productId: string, img: any, sortOrder: number) {
  const media = await prisma.mediaAsset.findFirst({
    where: { url: img.url },
    select: { id: true },
  })

  return prisma.productImage.create({
    data: {
      productId,
      mediaAssetId: media?.id,
      url: img.url,
      altText: img.altText,
      label: img.label,
      isMain: img.isMain ?? (sortOrder === 0),
      sortOrder,
    },
  })
}

// ─── Create Product ────────────────────────────────────────────

export async function createProduct(data: any, actor: AuthUser, ipAddress = '') {
  const { specs, images, industryIds, ...fields } = data

  let slug = generateSlug(fields.name)
  const existing = await prisma.product.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now()}`

  const existingSku = await prisma.product.findUnique({ where: { sku: fields.sku } })
  if (existingSku) {
    throw Object.assign(new Error('SKU already exists'), { status: 400 })
  }

  const product = await prisma.product.create({
    data: {
      ...fields, slug,
      createdBy: actor.id, updatedBy: actor.id,
    },
  })

  try {
    if (specs?.length) {
      for (const [i, s] of specs.entries()) {
        await prisma.productSpec.create({ data: { productId: product.id, name: s.name, value: s.value, isPublic: s.isPublic ?? true, sortOrder: i } })
      }
    }
    if (images?.length) {
      for (const [i, img] of images.entries()) {
        await createProductImage(product.id, img, i)
      }
    }
    if (industryIds?.length) {
      for (const industryId of industryIds) {
        await prisma.productIndustry.create({ data: { productId: product.id, industryId } })
      }
    }
  } catch (error) {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    throw error
  }

  const fullProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: productAdminInclude,
  })

  await logAudit({
    actor, action: 'product.create', entityType: 'product',
    entityId: product.id, entityName: product.name,
    newValue: { id: product.id, name: product.name, sku: product.sku, status: product.status, regularPrice: product.regularPrice },
    ipAddress,
  })

  return fullProduct
}

// ─── Update Product ────────────────────────────────────────────

export async function updateProduct(id: string, data: any, actor: AuthUser, ipAddress = '') {
  validateId(id)

  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Product not found'), { status: 404 })
  }

  const { specs, images, industryIds, ...fields } = data

  if (fields.name && fields.name !== existing.name) {
    let slug = generateSlug(fields.name)
    const slugExists = await prisma.product.findFirst({ where: { slug, id: { not: id } } })
    if (slugExists) slug = `${slug}-${Date.now()}`
    fields.slug = slug
  }

  if (fields.sku && fields.sku !== existing.sku) {
    const skuExists = await prisma.product.findUnique({ where: { sku: fields.sku } })
    if (skuExists) {
      throw Object.assign(new Error('SKU already exists'), { status: 400 })
    }
  }

  if (specs) {
    await prisma.productSpec.deleteMany({ where: { productId: id } })
    if (specs.length) {
      for (const [i, s] of specs.entries()) {
        await prisma.productSpec.create({ data: { productId: id, name: s.name, value: s.value, isPublic: s.isPublic ?? true, sortOrder: i } })
      }
    }
  }
  if (images) {
    await prisma.productImage.deleteMany({ where: { productId: id } })
    if (images.length) {
      for (const [i, img] of images.entries()) {
        await createProductImage(id, img, i)
      }
    }
  }
  if (industryIds) {
    await prisma.productIndustry.deleteMany({ where: { productId: id } })
    if (industryIds.length) {
      for (const industryId of industryIds) {
        await prisma.productIndustry.create({ data: { productId: id, industryId } })
      }
    }
  }

  await prisma.product.update({
    where: { id },
    data: { ...fields, updatedBy: actor.id },
  })

  const product = await prisma.product.findUnique({
    where: { id },
    include: productAdminInclude,
  })
  if (!product) {
    throw Object.assign(new Error('Product not found'), { status: 404 })
  }

  await logAudit({
    actor, action: 'product.update', entityType: 'product',
    entityId: product.id, entityName: product.name,
    previousValue: { id: existing.id, name: existing.name, sku: existing.sku, status: existing.status, regularPrice: existing.regularPrice },
    newValue: { id: product.id, name: product.name, sku: product.sku, status: product.status, regularPrice: product.regularPrice },
    ipAddress,
  })

  return product
}

// ─── Archive Product ───────────────────────────────────────────

export async function archiveProduct(id: string, actor: AuthUser, ipAddress = '') {
  validateId(id)

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    throw Object.assign(new Error('Product not found'), { status: 404 })
  }

  await prisma.product.update({
    where: { id },
    data: { status: 'archived', updatedBy: actor.id },
  })

  await logAudit({
    actor, action: 'product.archive', entityType: 'product',
    entityId: product.id, entityName: product.name,
    previousValue: { id: product.id, name: product.name, sku: product.sku, status: product.status },
    ipAddress,
  })
}

// ─── Bulk Update ───────────────────────────────────────────────

export async function bulkUpdate(ids: string[], action: string, value: string | undefined, actor: AuthUser, ipAddress = '') {
  let updateData: any
  switch (action) {
    case 'publish': updateData = { status: 'published' }; break
    case 'unpublish': updateData = { status: 'hidden' }; break
    case 'archive': updateData = { status: 'archived' }; break
    case 'set-featured': updateData = { isFeatured: true }; break
    case 'unset-featured': updateData = { isFeatured: false }; break
    case 'set-new-arrival': updateData = { isNewArrival: true }; break
    case 'mark-offer': updateData = { makeOfferEnabled: true }; break
    case 'set-category': updateData = { categoryId: value }; break
    case 'set-brand': updateData = { brandId: value }; break
    default: throw Object.assign(new Error('Invalid action'), { status: 400 })
  }

  updateData.updatedBy = actor.id

  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  })

  await logAudit({
    actor, action: `product.bulk.${action}`, entityType: 'product',
    newValue: { ids, action, value, affected: result.count },
    ipAddress,
  })

  return { updated: result.count }
}

// ─── Duplicate Product ─────────────────────────────────────────

export async function duplicateProduct(id: string, actor: AuthUser, ipAddress = '') {
  validateId(id)

  const source = await prisma.product.findUnique({
    where: { id },
    include: { specs: true, images: true, industries: { select: { industryId: true } } },
  })
  if (!source) throw Object.assign(new Error('Product not found'), { status: 404 })

  let slug = generateSlug(source.name + ' Copy')
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${Date.now()}`

  let sku = `${source.sku}-COPY`
  const skuExists = await prisma.product.findUnique({ where: { sku } })
  if (skuExists) sku = `${source.sku}-COPY-${Date.now()}`

  const product = await prisma.product.create({
    data: {
      name: `${source.name} (Copy)`, slug, sku,
      brandId: source.brandId, categoryId: source.categoryId,
      status: 'draft', availability: source.availability, condition: source.condition,
      shortDescription: source.shortDescription, description: source.description,
      regularPrice: source.regularPrice, salePrice: source.salePrice,
      currency: source.currency, showPrice: source.showPrice, makeOfferEnabled: source.makeOfferEnabled,
      stockCount: 0, lowStockThreshold: source.lowStockThreshold,
      warehouseLocation: source.warehouseLocation, leadTime: source.leadTime,
      isNewArrival: false, isFeatured: false,
      customLabel: source.customLabel, customLabelColor: source.customLabelColor,
      seoTitle: source.seoTitle, seoDescription: source.seoDescription,
      seoKeywords: source.seoKeywords,
      keyFeatures: source.keyFeatures, compatibilityNotes: source.compatibilityNotes,
      conditionNotes: source.conditionNotes, warrantyNotes: source.warrantyNotes,
      includedItems: source.includedItems, excludedItems: source.excludedItems,
      productType: source.productType,
      createdBy: actor.id, updatedBy: actor.id,
    },
  })

  try {
    if (source.specs.length) {
      for (const [i, s] of source.specs.entries()) {
        await prisma.productSpec.create({ data: { productId: product.id, name: s.name, value: s.value, isPublic: s.isPublic, sortOrder: i } })
      }
    }
    if (source.images.length) {
      for (const [i, img] of source.images.entries()) {
        await prisma.productImage.create({ data: { productId: product.id, mediaAssetId: img.mediaAssetId, url: img.url, altText: img.altText, label: img.label, isMain: img.isMain, sortOrder: i } })
      }
    }
    if (source.industries.length) {
      for (const ind of source.industries) {
        await prisma.productIndustry.create({ data: { productId: product.id, industryId: ind.industryId } })
      }
    }
  } catch (error) {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    throw error
  }

  const fullProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: productAdminInclude,
  })

  await logAudit({
    actor, action: 'product.duplicate', entityType: 'product',
    entityId: product.id, entityName: product.name,
    newValue: { sourceId: source.id, sourceName: source.name },
    ipAddress,
  })

  return fullProduct
}
