/**
 * Warm Cloudinary's on-demand transform cache for the images the storefront
 * actually serves.
 *
 * Cloudinary generates `f_auto,q_auto,w_800,c_limit` variants lazily: the
 * first visitor to ask waits 1.5–2.5s for the derivative to be rendered,
 * everyone after that gets it instantly (~150ms). Running this after a deploy
 * (or after bulk image uploads) means nobody pays that first-hit cost.
 *
 * Usage:
 *   node scripts/warm-cloudinary.mjs            # warm the live catalog
 *   API=https://api.alkatraders.co node scripts/warm-cloudinary.mjs
 */
const API = process.env.API || 'https://api.alkatraders.co'
import { readFile } from 'node:fs/promises'
const CLOUD = 'https://res.cloudinary.com/y7up4zti/image/upload'
const VARIANTS = ['w_800', 'w_1200'] // cards/grid + product gallery

/** Insert transforms into a Cloudinary URL (mirrors src/lib/utils.ts). */
function transform(url, width) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return null
  const first = (url.split('/image/upload/')[1] || '').split('/')[0] || ''
  if (first.includes('w_') || first.includes('f_auto')) return null // already sized
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,${width},c_limit/`)
}

async function json(path) {
  const res = await fetch(`${API}/api/v1${path}`)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

async function warm(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return { url, status: res.status }
  } catch (e) {
    return { url, status: 0, error: e.message }
  }
}

async function main() {
  const targets = new Set()

  // 1. Product images (every product's every image, in both variants)
  let offset = 0
  for (;;) {
    const page = await json(`/storefront/products?limit=100&page=${++offset}`)
    const products = page.products || []
    for (const p of products) {
      for (const img of p.images || []) {
        for (const v of VARIANTS) {
          const u = transform(img.url, v)
          if (u) targets.add(u)
        }
      }
    }
    if (products.length < 100 || offset >= 20) break
  }

  // 2. Home category tiles — ShopByCategory.tsx builds these from the IMAGE
  //    FILE NAME (not the category slug) and they never pass through
  //    getProductImageUrl (one shipped a 269 KB raw file). Parse the same list
  //    the component uses so this can never drift out of sync.
  try {
    const tsx = await readFile(new URL('../src/components/sections/ShopByCategory.tsx', import.meta.url), 'utf8')
    const files = [...tsx.matchAll(/file:\s*'([^']+)'/g)].map((m) => m[1])
    for (const file of files) {
      const slug = file.replace(/\.\w+$/, '').toLowerCase().replace(/\s+/g, '-')
      const u = transform(`${CLOUD}/v1/alka/categories/${slug}`, 'w_800')
      if (u) targets.add(u)
    }
    if (!files.length) console.warn('WARN no category tile files parsed from ShopByCategory.tsx')
  } catch (e) { console.warn('WARN category tiles skipped:', e.message) }

  // 3. Shared static assets that OptimizedImage may size on the fly
  for (const path of ['alka/static/placeholder', 'alka/static/alka-traders-logo']) {
    for (const v of VARIANTS) {
      const u = transform(`${CLOUD}/v1/${path}`, v)
      if (u) targets.add(u)
    }
  }

  const list = [...targets]
  console.log(`Warming ${list.length} transformed URLs (variants: ${VARIANTS.join(', ')})…`)

  const results = []
  const queue = [...list]
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) results.push(await warm(queue.shift()))
  })
  await Promise.all(workers)

  const failed = results.filter((r) => r.status !== 200)
  console.log(`OK: ${results.length - failed.length}/${results.length}`)
  for (const f of failed) console.log(`  FAIL ${f.status} ${f.url.slice(0, 120)} ${f.error || ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
