import { prisma } from '../server.js'

const BASE_URL = process.env.FRONTEND_URL || 'https://alkatraders.co'
const STATIC_LASTMOD = '2026-07-21'

// ─── In-memory cache (1 hour TTL) ────────────────────────────
let cachedXml: string | null = null
let cacheTime = 0
const CACHE_TTL_MS = 60 * 60 * 1000

// ─── Static pages with metadata ──────────────────────────────
const staticPages = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/shop', changefreq: 'weekly', priority: '0.9' },
  { path: '/products', changefreq: 'weekly', priority: '0.9' },
  { path: '/brands', changefreq: 'monthly', priority: '0.8' },
  { path: '/industries', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/network', changefreq: 'monthly', priority: '0.6' },
  { path: '/rfq', changefreq: 'monthly', priority: '0.8' },
  { path: '/emergency', changefreq: 'monthly', priority: '0.8' },
  { path: '/track-order', changefreq: 'monthly', priority: '0.5' },
  { path: '/intelligence', changefreq: 'weekly', priority: '0.7' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund-policy', changefreq: 'yearly', priority: '0.3' },
]

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Product image URLs are absolute Cloudinary links — only prefix site-relative ones. */
function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${BASE_URL}${url}`
}

async function buildSitemap(): Promise<string> {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'published' },
      select: { id: true, slug: true, updatedAt: true, images: { select: { url: true }, take: 1, where: { isMain: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.category.findMany({ where: { isVisible: true }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ where: { isVisible: true }, select: { slug: true, updatedAt: true } }),
  ])

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticPages.map((page) => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${STATIC_LASTMOD}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
${products.map((product) => `  <url>
    <loc>${BASE_URL}/product/${escapeXml(product.id)}</loc>
    <lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${product.images[0]?.url ? `\n    <image:image>\n      <image:loc>${escapeXml(absoluteUrl(product.images[0].url))}</image:loc>\n    </image:image>` : ''}
  </url>`).join('\n')}
${categories.map((cat) => `  <url>
    <loc>${BASE_URL}/products?category=${escapeXml(cat.slug)}</loc>
    <lastmod>${cat.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
${brands.map((brand) => `  <url>
    <loc>${BASE_URL}/products?brand=${escapeXml(brand.slug)}</loc>
    <lastmod>${brand.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`
}

export async function generateSitemap(): Promise<string> {
  if (cachedXml && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedXml
  }

  const xml = await buildSitemap()
  cachedXml = xml
  cacheTime = Date.now()
  return xml
}

export function getFallbackSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map((page) => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${STATIC_LASTMOD}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`
}
