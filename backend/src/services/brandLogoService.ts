import crypto from 'crypto'
import sharp from 'sharp'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '../server.js'
import { logAudit } from '../utils/audit.js'
import type { AuthUser } from '../middleware/auth.js'

// Configure Cloudinary from env (same config used by mediaService.ts)
cloudinary.config()

// ─── Queries ──────────────────────────────────────────────────
export async function getBrandLogo() {
  const setting = await prisma.storeSetting.findUnique({ where: { key: 'site.brandLogo' } })
  return { logoUrl: setting?.value || null }
}

// ─── Mutations ────────────────────────────────────────────────
export async function updateBrandLogo(logoUrl: string, actor: AuthUser, ipAddress = '') {
  await prisma.storeSetting.upsert({
    where: { key: 'site.brandLogo' },
    update: { value: logoUrl, updatedBy: actor.id },
    create: { key: 'site.brandLogo', value: logoUrl, updatedBy: actor.id },
  })

  await logAudit({ actor, action: 'brand-logo.update', entityType: 'store_settings', entityName: 'brandLogo', ipAddress })
  return { message: 'Brand logo updated' }
}

export async function deleteBrandLogo(actor: AuthUser, ipAddress = '') {
  await prisma.storeSetting.deleteMany({ where: { key: 'site.brandLogo' } })
  await logAudit({ actor, action: 'brand-logo.delete', entityType: 'store_settings', entityName: 'brandLogo', ipAddress })
  return { message: 'Brand logo deleted' }
}

// ─── Upload (per-brand logo → Cloudinary) ──────────────────
export async function uploadBrandLogo(brandId: string, file: Express.Multer.File, actor: AuthUser, ipAddress = '') {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } })
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })

  // Optimize and hash the image (same approach as mediaService.ts)
  const optimized = await optimizeImage(file.buffer, file.mimetype)
  const fileHash = generateHash(optimized)
  const publicId = `alka/brand-${brandId.slice(0, 8)}-${fileHash.slice(0, 16)}`

  // Upload to Cloudinary
  const url = await uploadToCloudinary(optimized, publicId)

  // Delete old logo from Cloudinary if it was a Cloudinary URL
  if (brand.logoUrl && brand.logoUrl.startsWith('https://res.cloudinary.com/')) {
    const oldPublicId = extractCloudinaryPublicId(brand.logoUrl)
    if (oldPublicId) {
      destroyCloudinary(oldPublicId).catch(err => {
        // Best-effort cleanup — do not fail the upload if Cloudinary delete fails
        console.warn(`[brandLogo] Failed to delete old Cloudinary asset ${oldPublicId}: ${err.message}`)
      })
    }
  }

  const updated = await prisma.brand.update({ where: { id: brandId }, data: { logoUrl: url } })

  await logAudit({
    actor, action: 'brand.logo.upload', entityType: 'brand', entityId: brand.id, entityName: brand.name,
    newValue: { logoUrl: url }, ipAddress,
  })

  return { brand: updated, url }
}

/**
 * Extract the Cloudinary public_id from a secure_url.
 * Example: https://res.cloudinary.com/y7up4zti/image/upload/v1234567/alka/abc123...
 * Returns: alka/abc123...
 */
function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\?|$)/)
  if (!match) return null
  return match[1].replace(/\.\w+$/, '')
}

/**
 * Helpers — same image processing as mediaService.ts so brand logos
 * get the same optimization + Cloudinary pipeline.
 */

function generateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function optimizeImage(buffer: Buffer, _mimetype: string): Promise<Buffer> {
  const image = sharp(buffer)
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (width > 2000 || height > 2000) {
    image.resize({ width: Math.min(width, 2000), height: Math.min(height, 2000), fit: 'inside', withoutEnlargement: true })
  }

  return image.rotate().webp({ quality: 85 }).toBuffer()
}

async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  const b64 = `data:image/webp;base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(b64, {
    public_id: publicId,
    resource_type: 'image',
    overwrite: false,
  })
  return result.secure_url
}

async function destroyCloudinary(publicId: string): Promise<boolean> {
  const result = await cloudinary.uploader.destroy(publicId, { invalidate: true })
  return result.result !== 'error'
}
