/**
 * Root Server Entry Point — Frontend App (alkatraders.co)
 *
 * Serve the Vite production build (frontend/dist/) as a static SPA with a
 * client-side routing fallback.
 *
 * Deployed on Railway as the "web" service:
 *   Build command: npm run build   (runs vite build + prerender + sitemap)
 *   Start command: node server.js
 *   Node.js:       22
 *
 * The API lives in a separate Railway service ("api") and is called directly
 * from the browser via VITE_API_URL — no proxying here.
 *
 * The Hostinger self-heal / warm-up-page logic has been removed: Railway runs
 * the build step before start, so the dist is always present at boot.
 */
import express from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000
const distPath = path.join(__dirname, 'frontend', 'dist')
const indexPath = path.join(distPath, 'index.html')
// Whether the built SPA is actually present — surfaced by the heartbeat so a
// deploy that somehow lost its dist/ is visible in the runtime log.
const serving = fs.existsSync(indexPath)

// ─── Observability ───────────────────────────────────────────────
// Heartbeat proves the process stays alive / detects restarts when the
// runtime log shows gaps. Request logging captures duration so a 408 spike
// can be tied to slow handlers or a dead/hung process. Writes go to BOTH
// stdout and stderr: some hosting panels only surface one of the two, and an
// empty log must never hide a running process.
function log(line) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] ${line}`)
  process.stderr.write(`[${ts}] ${line}\n`)
}

setInterval(() => {
  log(`[heartbeat] alive — serving=${serving} uptime=${Math.round(process.uptime())}s`)
}, 30000).unref()

// ─── Content Security Policy (report-only) ─────────────────────
// Sent as Content-Security-Policy-Report-Only: the browser enforces nothing
// but logs every violation it WOULD have blocked (DevTools console), so the
// policy can be validated against the real site before it is enforced.
// To enforce later, rename the header below to "Content-Security-Policy".
// (Mirrors frontend/server.js — both serve the same build.)
//
// Allowed (drawn from the actual production build):
//   - Google Fonts:  fonts.googleapis.com (css) + fonts.gstatic.com (woff2)
//   - Cloudinary:    res.cloudinary.com images
//   - API:           api.alkatraders.co via fetch()
//   - PayPal:        www.paypal.com / sandbox.paypal.com frames + SDK,
//                    www.paypalobjects.com assets
//   - Inline scripts: the Vite theme bootstrap in index.html is allowed via
//                    sha256 hashes computed at startup (no 'unsafe-inline');
//                    the font-preload onload handler via 'unsafe-hashes'.
//   - Inline styles: 'unsafe-inline' because React / framer-motion set style
//                    attributes at runtime (XSS defense stays on script-src).
function sha256Base64(value) {
  return crypto.createHash('sha256').update(value).digest('base64')
}

function computeInlineHashes() {
  const scripts = []
  const handlers = []
  try {
    const html = fs.readFileSync(indexPath, 'utf-8')
    const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
    let m
    while ((m = scriptRe.exec(html))) scripts.push(`'sha256-${sha256Base64(m[1])}'`)
    const handlerRe = /\b(?:onload|onerror|onclick|onchange|oninput)="([^"]*)"/g
    while ((m = handlerRe.exec(html))) handlers.push(`'sha256-${sha256Base64(m[1])}'`)
  } catch {
    // Build output not present yet — the warm-up page has no inline scripts.
  }
  return { scripts, handlers }
}

const inlineHashes = computeInlineHashes()

function cspPolicy() {
  // API origin comes from the environment so the same build works on
  // Hostinger, Railway, or any custom domain without rebuilding.
  // VITE_API_URL is inlined by Vite into the frontend bundle at build time,
  // but the CSP is sent by this Express server at runtime — so we read it
  // from the same env var the frontend uses.
  const apiOrigin = process.env.VITE_API_URL
    ? new URL(process.env.VITE_API_URL).origin
    : 'https://api.alkatraders.co'

  const scriptSrc = [
    "'self'",
    'https://www.paypal.com',
    'https://www.paypalobjects.com',
    ...inlineHashes.scripts,
  ].join(' ')
  const unsafeHashes = inlineHashes.handlers.length
    ? ` 'unsafe-hashes' ${inlineHashes.handlers.join(' ')}`
    : ''
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}${unsafeHashes}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://www.paypalobjects.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${apiOrigin} https://*.paypal.com https://*.paypalobjects.com`,
    'frame-src https://www.paypal.com https://sandbox.paypal.com',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy-Report-Only', cspPolicy())
  next()
})

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    log(`[req] ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`)
  })
  next()
})

// ─── Serve the built SPA ───────────────────────────────────────────
// On Railway the build step runs before start, so dist should always be present.
// If it is somehow missing (e.g. a bad deploy), fail fast rather than looping.
app.use(express.static(distPath))

// SPA fallback — any non-asset route returns index.html so client-side
// routing (e.g. /products, /admin) works on refresh / deep links.
app.get('*', (_req, res) => {
  res.sendFile(indexPath)
})

const server = app.listen(PORT, '0.0.0.0', () => {
  log(`Frontend serving ${distPath} on port ${PORT}`)
})

// Proxy-friendly socket timeouts: Node's default 5s keepAliveTimeout closes
// idle keep-alive sockets the platform proxy still reuses, surfacing as
// connection resets. Values are generous so legitimate long requests are
// unaffected, while a hung socket cannot hold a worker forever.
server.keepAliveTimeout = 75_000
server.headersTimeout = 80_000
server.requestTimeout = 80_000

// A boot failure (e.g. EADDRINUSE, invalid PORT) must be visible in the log.
server.on('error', (err) => {
  process.stderr.write(`FATAL [startup] listen failed on port ${PORT}: ${err.message}\n`)
  process.exit(1)
})