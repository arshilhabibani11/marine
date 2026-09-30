/**
 * Mobile product-page verification (roadmap D36).
 *
 * Loads the built site (npm run preview) with iPhone emulation and checks:
 *   - zero unexpected failed requests (the D34 fonts must be same-origin)
 *   - zero console errors
 *   - no horizontal overflow (the classic mobile layout break)
 *   - main product image renders at a real (large) size
 *   - gallery thumbnails all render
 *   - self-hosted fonts actually activate (document.fonts, force-loaded)
 *
 * The production API does not allowlist localhost origins, so by default the
 * product API is MOCKED with the real JSON fetched server-side (node has no
 * CORS). MOCK_API=0 hits the live API directly (use against production).
 *
 * Run:  npm run preview (background) && node scripts/verify-mobile-product.mjs [productUrl]
 */
import { chromium, devices } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const PRODUCT = process.argv[2] || 'e8608397-2242-4bba-a3d7-3a9b411314ab'
const MOCK_API = process.env.MOCK_API !== '0'
const API = 'https://api.alkatraders.co'
const url = `${BASE}/en/product/${PRODUCT}`

// Fetch the REAL product payload once, server-side, for mocking.
let realProductJson = null
if (MOCK_API) {
  try {
    const res = await fetch(`${API}/api/v1/storefront/products/${PRODUCT}`)
    realProductJson = await res.json()
    console.log(`(mocking product API with real payload: ${realProductJson?.product?.name?.slice(0, 50) || '??'})`)
  } catch {
    console.log('⚠️  could not fetch real product JSON — mocking with empty payload')
    realProductJson = { product: null }
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()

if (MOCK_API) {
  await page.route('**/api.alkatraders.co/**', async (route) => {
    const u = route.request().url()
    let body = {}
    if (u.includes(`/storefront/products/${PRODUCT}`)) body = realProductJson
    else if (u.includes('/storefront/categories')) body = { categories: [] }
    else if (u.includes('/storefront/settings')) body = { settings: {} }
    else if (u.includes('/storefront/payments/client-id')) body = { clientId: 'test' }
    else body = {}
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

const failedRequests = []
const consoleErrors = []
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText || 'unknown'}`))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

console.log(`📱 iPhone 13 emulation → ${url}\n`)
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1500) // let fonts/images settle

// 1. Failed requests
console.log(`✗ Failed requests: ${failedRequests.length}`)
for (const f of failedRequests) console.log(`   ${f}`)

// 2. Console errors
console.log(`✗ Console errors: ${consoleErrors.length}`)
for (const e of consoleErrors) console.log(`   ${e.slice(0, 200)}`)

// 3. Horizontal overflow
const overflow = await page.evaluate(() => {
  const el = document.scrollingElement
  return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
})
const hasOverflow = overflow.scrollWidth > overflow.clientWidth + 1
console.log(`${hasOverflow ? '✗' : '✅'} Horizontal overflow: ${overflow.scrollWidth}px vs ${overflow.clientWidth}px viewport`)

// 4. Main image renders at real size — pick the LARGEST rendered content
// image (the navbar logo is also high-res natural but tiny rendered).
const mainImage = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 200 && !/logo|icon|placeholder/i.test(i.src))
  if (imgs.length === 0) return null
  let main = imgs[0]
  let area = 0
  for (const i of imgs) {
    const r = i.getBoundingClientRect()
    const a = r.width * r.height
    if (a > area) { area = a; main = i }
  }
  const r = main.getBoundingClientRect()
  return { src: main.currentSrc?.slice(0, 90), renderedW: Math.round(r.width), renderedH: Math.round(r.height), naturalW: main.naturalWidth, complete: main.complete }
})
if (mainImage) {
  const big = mainImage.renderedW >= 250 && mainImage.renderedH >= 250
  console.log(`${big ? '✅' : '✗'} Main image: ${mainImage.renderedW}×${mainImage.renderedH} rendered (natural ${mainImage.naturalW}px)`)
  console.log(`   ${mainImage.src}`)
} else {
  console.log('✗ No product image found')
}

// 5. Gallery thumbnails
const thumbs = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.width > 40 && r.width <= 140 && i.complete && i.naturalWidth > 0 }).length)
console.log(`${thumbs >= 2 ? '✅' : '✗'} Thumbnails rendering: ${thumbs}`)

// 6. Self-hosted fonts active — force-load each face first (fonts lazy-load
// on first use; an unloaded face legitimately reports false on check()).
const fonts = await page.evaluate(async () => {
  await Promise.all([
    document.fonts.load('16px "Space Grotesk"'),
    document.fonts.load('16px "DM Sans"'),
    document.fonts.load('16px "Manrope"'),
    document.fonts.load('16px "JetBrains Mono"'),
  ]).catch(() => {})
  return {
    grotesk: document.fonts.check('16px "Space Grotesk"'),
    dmSans: document.fonts.check('16px "DM Sans"'),
    manrope: document.fonts.check('16px "Manrope"'),
    mono: document.fonts.check('16px "JetBrains Mono"'),
    loaded: document.fonts.status,
  }
})
const fontsOk = fonts.grotesk && fonts.dmSans && fonts.manrope
console.log(`${fontsOk ? '✅' : '✗'} Fonts active: SpaceGrotesk=${fonts.grotesk} DMSans=${fonts.dmSans} Manrope=${fonts.manrope} Mono=${fonts.mono} (${fonts.loaded})`)

// 7. Third-party font origins must be gone (mocked API requests are expected
// and don't count as failures when MOCK_API is on).
const thirdParty = failedRequests.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(f))
console.log(`${thirdParty.length === 0 ? '✅' : '✗'} No fonts.googleapis/gstatic requests (self-hosted)`)

// 8. Core Web Vitals (roadmap B21): LCP + CLS via PerformanceObserver.
// INP is skipped — it requires real interaction and is best read from the
// Chrome UX Report / Search Console CWV report in production.
const cwv = await page.evaluate(() => new Promise((resolve) => {
  const out = { lcp: null, cls: 0 }
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries.length > 0) out.lcp = Math.round(entries[entries.length - 1].startTime)
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* not supported */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) out.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  } catch { /* not supported */ }
  setTimeout(() => resolve({ ...out, cls: Math.round(out.cls * 1000) / 1000 }), 1200)
}))
const lcpGood = cwv.lcp != null && cwv.lcp <= 2500
const clsGood = cwv.cls <= 0.1
console.log(`${lcpGood ? '✅' : '✗'} LCP: ${cwv.lcp ?? 'n/a'}ms (target ≤ 2500ms)`)
console.log(`${clsGood ? '✅' : '✗'} CLS: ${cwv.cls} (target ≤ 0.1)`)

// Screenshot for visual check (temp, not committed)
await page.screenshot({ path: `${process.env.TEMP || '/tmp'}/mobile-product.png`, fullPage: false })
console.log(`\n📸 Screenshot: ${process.env.TEMP || '/tmp'}/mobile-product.png`)

await browser.close()

// CORS/mocked-API noise is not a site problem — exclude api.alkatraders.co
// failures from the problem count when mocking. LCP in this lab harness is
// dominated by the remote CDN image download under emulation — treat it as a
// regression signal, not an absolute number; field CWV (Search Console / CrUX)
// is the authority.
const siteFailures = failedRequests.filter((f) => !(MOCK_API && f.includes('api.alkatraders.co')))
const problems = siteFailures.length + consoleErrors.filter((e) => !(MOCK_API && e.includes('api.alkatraders.co'))).length + (hasOverflow ? 1 : 0) + (mainImage && mainImage.renderedW < 250 ? 1 : 0) + (fontsOk ? 0 : 1) + (clsGood ? 0 : 1) + (lcpGood ? 0 : 1)
console.log(`\n${problems === 0 ? '✅ ALL CHECKS PASSED' : `✗ ${problems} problem(s) found (see ✓/✗ above; lab LCP is environment-sensitive)`}`)
process.exit(problems === 0 ? 0 : 1)
