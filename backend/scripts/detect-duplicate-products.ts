/**
 * Duplicate product detection (roadmap B17 — spec Phase 30).
 *
 * Flags probable duplicate products using IDENTITY signals only — never
 * titles alone, never prices. Signals (strongest first):
 *   gtin      → same verified barcode = same product (definitive)
 *   mpn+maker → same manufacturer part number from the same manufacturer
 *   impa      → same IMPA code
 *   model+maker → same model number from the same manufacturer
 *   name+brand  → identical normalized name within one brand (weak, needs review)
 *
 * Read-only: prints clusters for admin review. Merging is a HUMAN decision —
 * product reality decides, not keyword similarity.
 *
 * Run: cd backend && npx tsx scripts/detect-duplicate-products.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Normalized comparison key: lowercase, strip punctuation/spacing. */
function key(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).toLowerCase().replace(/[^a-z0-9]/g, '')
  return s.length >= 3 ? s : null
}

/** Weak name key: collapse whitespace, strip condition noise, keep letters/digits/spaces. */
function nameKey(name: string): string | null {
  const s = String(name || '')
    .toLowerCase()
    .replace(/\b(new|unused|used|refurbished|reconditioned|genuine|original)\b/gi, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length >= 4 ? s : null
}

interface Signal {
  field: string
  value: string
  strength: 'definitive' | 'strong' | 'review'
}

function signalsFor(p: {
  gtin: string | null
  mpn: string | null
  impaCode: string | null
  modelNumber: string | null
  manufacturer: string | null
  name: string
  brandName: string | null
}): Signal[] {
  const out: Signal[] = []
  const gtin = key(p.gtin)
  const mpn = key(p.mpn)
  const impa = key(p.impaCode)
  const model = key(p.modelNumber)
  const maker = key(p.manufacturer) || key(p.brandName)
  const name = nameKey(p.name)
  const brand = key(p.brandName)

  if (gtin) out.push({ field: 'gtin', value: `gtin:${gtin}`, strength: 'definitive' })
  if (mpn && maker) out.push({ field: 'mpn', value: `mpn:${maker}|${mpn}`, strength: 'strong' })
  if (impa) out.push({ field: 'impa', value: `impa:${impa}`, strength: 'strong' })
  if (model && maker) out.push({ field: 'model', value: `model:${maker}|${model}`, strength: 'strong' })
  if (name && brand) out.push({ field: 'name', value: `name:${brand}|${name}`, strength: 'review' })
  return out
}

async function main() {
  const products = await prisma.product.findMany({
    where: { status: { not: 'archived' } },
    select: {
      id: true, sku: true, name: true,
      gtin: true, mpn: true, impaCode: true, modelNumber: true, manufacturer: true,
      brand: { select: { name: true } },
    },
  })

  console.log(`\n🔎 Duplicate detection across ${products.length} products (read-only)\n`)

  // Group by signal value → clusters with ≥2 members are candidates.
  const buckets = new Map<string, { ids: string[]; strength: Signal['strength']; field: string; value: string }>()
  for (const p of products) {
    for (const s of signalsFor({ ...p, brandName: p.brand?.name ?? null })) {
      const b = buckets.get(s.value) || { ids: [], strength: s.strength, field: s.field, value: s.value }
      b.ids.push(`${p.name} (${p.sku}) [${p.id}]`)
      buckets.set(s.value, b)
    }
  }

  const clusters = [...buckets.values()].filter((b) => b.ids.length >= 2)
  if (clusters.length === 0) {
    console.log('✅ No duplicate signals found.\n')
  } else {
    const order = { definitive: 0, strong: 1, review: 2 } as const
    clusters.sort((a, b) => order[a.strength] - order[b.strength])
    for (const c of clusters) {
      const badge = c.strength === 'definitive' ? '🔴 DEFINITIVE' : c.strength === 'strong' ? '🟠 STRONG' : '🟡 REVIEW'
      console.log(`${badge} ${c.field} — ${c.ids.length} products`)
      for (const id of c.ids) console.log(`    ${id}`)
      console.log('')
    }
    console.log('Review each cluster manually: same product → merge/flag; genuinely')
    console.log('different → keep both and improve their identity data.\n')
  }

  // Identity-completeness report (feeds MANUAL_TASKS MT-4 prioritization).
  const missing = products.filter((p) => !p.gtin && !p.mpn && !p.impaCode && !p.modelNumber && !p.manufacturer)
  if (missing.length > 0) {
    console.log(`📋 ${missing.length}/${products.length} products have NO identity fields — candidates for MT-4 data entry:`)
    for (const p of missing) console.log(`    ${p.name} (${p.sku})`)
  }
}

main()
  .catch((err) => { console.error('Duplicate detection failed:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
