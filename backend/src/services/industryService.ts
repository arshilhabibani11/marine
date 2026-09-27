import { prisma } from '../server.js'
import { generateSlug } from '../utils/helpers.js'
import { logAudit } from '../utils/audit.js'
import { invalidateCachePath } from '../middleware/cacheGet.js'
import type { AuthUser } from '../middleware/auth.js'

// ─── Queries ──────────────────────────────────────────────────

export async function listAdminIndustries() {
  const industries = await prisma.industry.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  })
  return { industries }
}

export async function listStorefrontIndustries() {
  const industries = await prisma.industry.findMany({
    where: { isVisible: true },
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  })
  return { industries }
}

export async function getIndustryBySlug(slug: string) {
  const industry = await prisma.industry.findFirst({
    where: { slug, isVisible: true },
    include: { _count: { select: { products: true } } },
  })
  if (!industry) throw Object.assign(new Error('Industry not found'), { status: 404 })
  return { industry }
}

// ─── Mutations ────────────────────────────────────────────────

export async function createIndustry(data: Record<string, unknown>, actor: AuthUser, ipAddress = '') {
  const slug = generateSlug(data.name as string)
  const existing = await prisma.industry.findUnique({ where: { slug } })
  if (existing) throw Object.assign(new Error('Industry with this name already exists'), { status: 400 })

  const industry = await prisma.industry.create({ data: { ...data, slug } as never })
  invalidateCachePath('/storefront/industries')
  await logAudit({ actor, action: 'industry.create', entityType: 'industry', entityId: industry.id, entityName: industry.name, newValue: industry, ipAddress })
  return { industry }
}

export async function updateIndustry(id: string, data: Record<string, unknown>, actor: AuthUser, ipAddress = '') {
  const existing = await prisma.industry.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('Industry not found'), { status: 404 })

  let slug = existing.slug
  if (data.name && data.name !== existing.name) {
    slug = generateSlug(data.name as string)
    const slugExists = await prisma.industry.findFirst({ where: { slug, id: { not: id } } })
    if (slugExists) slug = `${slug}-${Date.now()}`
  }

  const industry = await prisma.industry.update({ where: { id }, data: { ...data, slug } })
  invalidateCachePath('/storefront/industries')
  await logAudit({ actor, action: 'industry.update', entityType: 'industry', entityId: industry.id, entityName: industry.name, previousValue: existing, newValue: industry, ipAddress })
  return { industry }
}

export async function deleteIndustry(id: string, actor: AuthUser, ipAddress = '') {
  const existing = await prisma.industry.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!existing) throw Object.assign(new Error('Industry not found'), { status: 404 })
  if (existing._count.products > 0) throw Object.assign(new Error('Cannot delete industry with products.'), { status: 400 })

  await prisma.industry.delete({ where: { id } })
  invalidateCachePath('/storefront/industries')
  await logAudit({ actor, action: 'industry.delete', entityType: 'industry', entityId: existing.id, entityName: existing.name, previousValue: existing, ipAddress })
  return { message: 'Industry deleted' }
}
