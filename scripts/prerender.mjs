#!/usr/bin/env node

/**
 * Build-time Prerender Script
 *
 * Generates static HTML shell files for every route in the SPA across
 * three locales (en, ar, es). Each file includes:
 *   - Correct <html lang="..." dir="..."> attributes per locale
 *   - Complete <head> with locale-specific title, meta description,
 *     Open Graph, Twitter Card
 *   - hreflang alternate links for all locales + x-default
 *   - <link rel="canonical"> pointing to the locale-specific URL
 *   - JSON-LD structured data
 *   - Visible <h1> + <p> body content inside <div id="root"> so
 *     Googlebot sees real content and does NOT classify as "Soft 404"
 *   - Standard SPA script so React hydrates on load for human visitors
 *
 * Usage: node scripts/prerender.mjs [--dist <dir>]
 *   --dist   output directory (default: dist). Hostinger's frontend app
 *            serves frontend/dist, so its build passes --dist frontend/dist.
 * Runs automatically after `npm run build` via postbuild chain.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { getAllRoutes } from './prerender-routes.mjs'
import { fetchPublishedProducts, extractIdentityQuick, extractProductTypeQuick, buildProductTitleQuick } from './fetch-products.mjs'

const distArgIndex = process.argv.indexOf('--dist')
const DIST = distArgIndex !== -1 && process.argv[distArgIndex + 1]
  ? process.argv[distArgIndex + 1]
  : 'dist'
const BASE_URL = 'https://alkatraders.co'
const SITE_NAME = 'Alka Traders'
const DEFAULT_DESC = 'Global supplier of marine spares, industrial equipment, surplus machinery, and emergency procurement parts. Based in Bhavnagar, Gujarat, India.'
const LOGO_URL = 'https://res.cloudinary.com/y7up4zti/image/upload/v1/alka/static/alka-traders-logo'

// ─── Helpers ────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Locale → og:locale value */
const LOCALE_OG_MAP = { en: 'en_US', ar: 'ar_SA', es: 'es_ES' }
/** Locale → dir attribute */
const LOCALE_DIR_MAP = { en: 'ltr', ar: 'rtl', es: 'ltr' }

// ─── Hreflang Tags ──────────────────────────────────────────────

/**
 * Generate hreflang <link> tags for all three locales plus x-default.
 * @param {string} path - The FULL locale-prefixed path, e.g. "/en/products"
 */
function hreflangTags(path) {
  // Extract the path without locale prefix
  const segments = path.split('/').filter(Boolean)
  const locale = segments[0] // 'en', 'ar', or 'es'
  const rest = segments.slice(1).join('/') // 'products', 'product/prod-001', etc.

  const tags = []
  const locales = ['en', 'ar', 'es']

  for (const lang of locales) {
    let href
    if (lang === 'en' && !rest) {
      href = BASE_URL
    } else if (lang === 'en' && rest) {
      href = `${BASE_URL}/en/${rest}`
    } else if (!rest) {
      href = `${BASE_URL}/${lang}`
    } else {
      href = `${BASE_URL}/${lang}/${rest}`
    }
    tags.push(`<link rel="alternate" hreflang="${lang}" href="${href}" />`)
  }

  // x-default → English
  const defaultHref = !rest ? BASE_URL : `${BASE_URL}/en/${rest}`
  tags.push(`<link rel="alternate" hreflang="x-default" href="${defaultHref}" />`)

  return tags.join('\n  ')
}

// ─── JSON-LD Generators ─────────────────────────────────────────

function orgJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: LOGO_URL,
    description: DEFAULT_DESC,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'PLOT - 7 ALANG HOUSE, MOTITALAV ROAD, KHUMBHARWADA',
      addressLocality: 'Bhavnagar',
      addressRegion: 'Gujarat',
      postalCode: '364001',
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+918799095041',
      contactType: 'sales',
      availableLanguage: ['English', 'Arabic', 'Spanish'],
    },
    sameAs: ['https://www.linkedin.com/company/alka-traders'],
  }
}

function breadcrumbJsonLd(segments) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: segments.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      item: `${BASE_URL}${s.path}`,
    })),
  }
}

/**
 * Product JSON-LD built from REAL product data (fetched from the API at
 * build time). Replaces the old getProductPrice() that fabricated a price
 * from the product UUID — a Google rich-results policy violation. Identity
 * (model/MPN/IMPA) comes from Item Specifics the admin recorded; unknown
 * fields are omitted, and IMPA is additionalProperty (never GTIN).
 */
function productJsonLd(p, locale) {
  const identity = extractIdentityQuick(p.description)
  const productType = extractProductTypeQuick(p.name, p.category)
  const brand = p.brand && p.brand !== 'Unknown' ? p.brand : undefined
  const h1 = [brand, identity.model || identity.mpn, productType].filter(Boolean).join(' ') || p.name.slice(0, 80)
  const effectivePrice = p.onSale && p.salePrice ? p.salePrice : p.price
  const mainImage = p.images?.[0]?.url

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: h1,
    sku: p.sku,
    ...(identity.mpn ? { mpn: identity.mpn } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(mainImage ? { image: [mainImage] } : {}),
    ...(identity.impa
      ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'IMPA Code', value: identity.impa.replace(/\s+/g, '') }] }
      : {}),
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/${locale}/product/${p.id}`,
      priceCurrency: 'USD',
      price: effectivePrice.toFixed(2),
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: p.condition === 'new' || p.condition === 'unused'
        ? 'https://schema.org/NewCondition'
        : p.condition === 'refurbished' || p.condition === 'reconditioned'
          ? 'https://schema.org/RefurbishedCondition'
          : 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  }
  return product
}

// ─── SEO Head Generator ─────────────────────────────────────────

function seoHeadTags({ path, title, description, locale = 'en', extraJsonLd, breadcrumbs, ogType, ogImage, ogImageAlt }) {
  const fullTitle = title || `${SITE_NAME} — ${DEFAULT_DESC}`
  const fullDesc = description || DEFAULT_DESC
  const url = path === `/${locale}` ? `${BASE_URL}/${locale}` : `${BASE_URL}${path}`

  const jsonLdBlocks = [orgJsonLd()]
  if (breadcrumbs) jsonLdBlocks.push(breadcrumbJsonLd(breadcrumbs))
  if (extraJsonLd) {
    Array.isArray(extraJsonLd) ? jsonLdBlocks.push(...extraJsonLd) : jsonLdBlocks.push(extraJsonLd)
  }

  // WebSite schema + SearchAction
  jsonLdBlocks.push({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  })

  const ogLocale = LOCALE_OG_MAP[locale] || 'en_US'

  const tags = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(fullDesc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    hreflangTags(path),

    `<!-- Open Graph -->`,
    `<meta property="og:title" content="${esc(fullTitle)}" />`,
    `<meta property="og:description" content="${esc(fullDesc)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${ogType || 'website'}" />`,
    `<meta property="og:image" content="${esc(ogImage || LOGO_URL)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(ogImageAlt || fullTitle)}" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,

    `<!-- Twitter Card -->`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
    `<meta name="twitter:description" content="${esc(fullDesc)}" />`,
    `<meta name="twitter:image" content="${LOGO_URL}" />`,
  ]

  const jsonLdScripts = jsonLdBlocks.map(block =>
    `<script type="application/ld+json">${JSON.stringify(block)}</script>`
  )

  return tags.join('\n  ') + '\n  ' + jsonLdScripts.join('\n  ')
}

// ─── Body Content Generator ─────────────────────────────────────

/**
 * Generate visible body content that Googlebot can read inside <div id="root">.
 * React will replace this content on hydration for human visitors.
 */
function generateBodyHtml({ title, description, h1 }) {
  // h1 (when provided) is the short product identity without the identifier
  // tail — better as visible H1 text than the full SEO title.
  const heading = h1 || title || 'Alka Traders'
  const desc = description || DEFAULT_DESC
  // React will replace this content on hydration for human visitors. The
  // seo-shell class is hidden via inline CSS in index.html so it never
  // flashes before React mounts, while crawlers still read the markup.
  return `<div class="seo-shell">\n      <h1>${esc(heading)}</h1>\n      <p>${esc(desc)}</p>\n    </div>`
}

// ─── Template Injection ─────────────────────────────────────────

function injectIntoTemplate(template, path, routeData) {
  const locale = routeData.locale || 'en'
  const headTags = seoHeadTags({ ...routeData, path, locale })

  let html = template

  // Set <html lang="..." dir="...">
  html = html.replace(/<html[^>]*>/i, () => {
    return `<html lang="${locale}" dir="${LOCALE_DIR_MAP[locale] || 'ltr'}">`
  })

  // Remove existing <title>
  html = html.replace(/<title>[^<]*<\/title>/, '')
  // Remove existing meta description
  html = html.replace(/<meta name="description"[^>]*\/?>/, '')
  // Remove the template's hardcoded Open Graph / Twitter tags — seoHeadTags
  // emits page-specific ones. Keeping both produced duplicate og:image
  // (template logo AFTER the real product image) and og:type=website on
  // product pages.
  html = html.replace(/<meta property="og:[^"]*"[^>]*\/>\s*/g, '')
  html = html.replace(/<meta name="twitter:[^"]*"[^>]*\/>\s*/g, '')
  html = html.replace(/<!--[\s]*Open Graph[\s]*-->\s*/g, '')
  html = html.replace(/<!--[\s]*Twitter Card[\s]*-->\s*/g, '')

  // Inject SEO tags after <head>
  html = html.replace('<head>', '<head>\n  ' + headTags)

  // Inject visible body content inside <div id="root"> so Googlebot
  // sees real heading + description text (not just an empty shell).
  html = html.replace(
    '<div id="root">',
    `<div id="root">\n    ${generateBodyHtml(routeData)}`
  )

  return html
}

// ─── File Writer ────────────────────────────────────────────────

function writeHtml(path, html) {
  // English home serves BOTH the root URL (/) and the locale path (/en/), so
  // deep links and static-only hosts (Hostinger serving frontend/dist without
  // the Node fallback) can serve /en/ directly.
  if (path === '/' || path === '/en') {
    const targets = [join(DIST, 'index.html')]
    if (path === '/en') targets.push(join(DIST, 'en', 'index.html'))
    for (const filePath of targets) {
      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, html, 'utf-8')
    }
    console.log(`  ✅ ${path}/`)
    return
  }

  const filePath = join(DIST, path, 'index.html')
  const dir = dirname(filePath)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(filePath, html, 'utf-8')
  console.log(`  ✅ ${path}/`)
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Generating prerendered HTML shells (3 locales)...\n')

  const indexPath = join(DIST, 'index.html')
  if (!existsSync(indexPath)) {
    console.error(`❌ dist/index.html not found. Run "npm run build" first.`)
    process.exit(1)
  }

  const template = readFileSync(indexPath, 'utf-8')
  const routes = getAllRoutes()
  let count = 0

  for (const route of routes) {
    const locale = route.locale || 'en'
    let extraJsonLd
    let breadcrumbs

    // Home pages get FAQPage schema (one per locale)
    if (route.path === `/${locale}`) {
      breadcrumbs = [{ name: 'Home', path: `/${locale}` }]
      extraJsonLd = [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What marine spare parts does Alka Traders supply?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Alka Traders supplies ship automation parts, marine engine spares, hydraulic pumps and motors, navigation equipment, electrical drives, marine pumps, rigging, lifting gear, and surplus industrial machinery.',
              },
            },
            {
              '@type': 'Question',
              name: 'Where are Alka Traders marine parts shipped from?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Most export orders are coordinated from Bhavnagar, Gujarat, India, near the Alang marine equipment and ship recycling market.',
              },
            },
            {
              '@type': 'Question',
              name: 'Can I request a quote with only a part number or nameplate photo?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Buyers can send a part number, maker name, model, serial plate photo, or product description through the RFQ form, email, or WhatsApp.',
              },
            },
          ],
        },
      ]
    }

    // Product routes are prerendered separately below with REAL data from
    // the API — static route list contains no product paths.
    if (route.path.includes('/product/')) {
      continue
    }

    // Other pages get generic breadcrumbs
    if (!route.path.includes('/product/') && route.path !== `/${locale}`) {
      const segments = route.path.replace(`/${locale}/`, '').split('/').filter(Boolean)
      breadcrumbs = [
        { name: 'Home', path: `/${locale}` },
        ...segments.map((seg, i) => ({
          name: seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          path: `/${locale}/` + segments.slice(0, i + 1).join('/'),
        })),
      ]
    }

    const html = injectIntoTemplate(template, route.path, {
      title: route.title,
      description: route.description,
      locale,
      extraJsonLd,
      breadcrumbs,
    })
    writeHtml(route.path, html)
    count++
  }

  // ── Product pages: prerendered from REAL API data (per locale) ──
  // Identity is parsed from the admin description's Item Specifics; titles
  // and JSON-LD contain only verified facts. If the API is unreachable the
  // build still succeeds — product URLs simply aren't prerendered this run.
  const products = await fetchPublishedProducts()
  console.log(`  📦 Fetched ${products.length} published products from the API\n`)
  for (const p of products) {
    const identity = extractIdentityQuick(p.description)
    const productType = extractProductTypeQuick(p.name, p.category)
    const brand = p.brand && p.brand !== 'Unknown' ? p.brand : undefined
    const h1 = [brand, identity.model || identity.mpn, productType].filter(Boolean).join(' ') || p.name.slice(0, 80)

    for (const locale of ['en', 'ar', 'es']) {
      const parts = [brand ? `${brand} ${productType.toLowerCase()}` : `${productType.toLowerCase()} (${p.sku}) supplied by Alka Traders`]
      if (identity.impa) parts.push(`IMPA ${identity.impa.replace(/\s+/g, '')}`)
      if (identity.size) parts.push(identity.size)
      if (identity.material) parts.push(identity.material.toLowerCase())
      parts.push(p.inStock ? 'in stock for export dispatch' : 'check availability with our procurement team')
      const metaDesc = `${parts.join(', ').replace(/,\s*\./, '.')}.`.slice(0, 158)

      const productPath = `/${locale}/product/${p.id}`
      const mainImage = p.images?.[0]?.url
      const html = injectIntoTemplate(template, productPath, {
        title: buildProductTitleQuick(p),
        description: metaDesc,
        h1,
        ogType: 'product',
        ogImage: mainImage,
        ogImageAlt: `${h1}${identity.size ? ` — ${identity.size}` : ''}`,
        locale,
        extraJsonLd: productJsonLd(p, locale),
        breadcrumbs: [
          { name: 'Home', path: `/${locale}` },
          { name: 'Products', path: `/${locale}/products` },
          { name: h1, path: productPath },
        ],
      })
      writeHtml(productPath, html)
      count++
    }
  }

  // ── Prerendered HTML shells are served directly by Hostinger's Node
  // server (frontend/server.js SPA fallback) — no _redirects file needed.
  console.log(`\n✨ Prerendered ${count} pages to ${DIST}/\n`)
}

await main()
