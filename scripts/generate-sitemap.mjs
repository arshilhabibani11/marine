#!/usr/bin/env node

/**
 * Sitemap Generator
 *
 * Reads the full route list (including locale-prefixed paths) from
 * prerender-routes.mjs and generates a sitemap.xml with:
 *   - Every locale variant as its own <url> entry
 *   - xhtml:link rel="alternate" hreflang for all 3 locales + x-default
 *   - changefreq and priority from the route data
 *
 * Usage:  node scripts/generate-sitemap.mjs [--dist <dir>]
 *   --dist   output directory for sitemap.xml (default: dist).
 *            Hostinger's frontend app serves frontend/dist, so its build
 *            passes --dist frontend/dist.
 * Output: <dist>/sitemap.xml (overwrites)
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { getAllRoutes } from './prerender-routes.mjs'
import { fetchPublishedProducts } from './fetch-products.mjs'

const BASE_URL = 'https://alkatraders.co'
const LOCALES = ['en', 'ar', 'es']
const VALID_LOCALES = LOCALES

/**
 * Build the xhtml:link hreflang tags for a given page path.
 * @param {string} path - e.g. '/en/products'
 * @returns {string[]} array of <xhtml:link ... /> strings
 */
function buildHreflangLinks(localePath) {
  // Extract locale and rest path
  const segments = localePath.split('/').filter(Boolean)
  const rest = segments.length > 1 ? segments.slice(1).join('/') : ''

  const links = []

  for (const lang of VALID_LOCALES) {
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
    links.push(`      <xhtml:link rel="alternate" hreflang="${lang}" href="${href}" />`)
  }

  // x-default → English
  const defaultHref = !rest ? BASE_URL : `${BASE_URL}/en/${rest}`
  links.push(`      <xhtml:link rel="alternate" hreflang="x-default" href="${defaultHref}" />`)

  return links
}

/** ISO date (YYYY-MM-DD) for <lastmod>, or undefined when unknown. */
function isoDate(value) {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

function buildUrlEntry(route) {
  const loc = route.path === '/en' ? BASE_URL : `${BASE_URL}${route.path}`
  const hreflangLines = buildHreflangLinks(route.path)
  const changefreq = route.changefreq || 'monthly'
  const priority = route.priority || 0.5
  // lastmod only when meaningful content actually changed (product updatedAt).
  const lastmod = route.lastmod
    ? `\n      <lastmod>${route.lastmod}</lastmod>`
    : ''

  return [
    '    <url>',
    `      <loc>${loc}</loc>`,
    ...hreflangLines,
    lastmod,
    `      <changefreq>${changefreq}</changefreq>`,
    `      <priority>${priority.toFixed(1)}</priority>`,
    '    </url>',
  ].join('\n')
}

async function main() {
  console.log('\n🔍 Generating sitemap.xml...\n')

  const routes = getAllRoutes()

  // Product URLs: one <url> per product per locale, with lastmod from the
  // product's actual updatedAt (never a fabricated date). If the API is
  // unreachable, the sitemap still ships — with static pages only.
  const products = await fetchPublishedProducts()
  console.log(`  📦 Fetched ${products.length} published products from the API`)
  for (const p of products) {
    for (const locale of LOCALES) {
      routes.push({
        path: `/${locale}/product/${p.id}`,
        priority: 0.8,
        changefreq: 'weekly',
        lastmod: isoDate(p.updatedAt),
      })
    }
  }

  const urlEntries = routes.map(buildUrlEntry)

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '',
    ...urlEntries,
    '',
    '</urlset>',
    '',
  ].join('\n')

  const distArgIndex = process.argv.indexOf('--dist')
  const outDir = distArgIndex !== -1 && process.argv[distArgIndex + 1]
    ? process.argv[distArgIndex + 1]
    : 'dist'
  const outPath = join(outDir, 'sitemap.xml')
  writeFileSync(outPath, sitemap, 'utf-8')

  console.log(`  ✅ ${routes.length} URLs written to ${outPath}`)
  console.log(`     (${LOCALES.length} locales × ${routes.length / LOCALES.length} unique pages)`)
  console.log(`     Sitemap size: ${(Buffer.byteLength(sitemap) / 1024).toFixed(1)} KB\n`)
}

await main()
