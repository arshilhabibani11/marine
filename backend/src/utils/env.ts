import dotenv from 'dotenv'

// ESM hoists imports, so any module that reads process.env at load time would run
// before a `dotenv.config()` call placed in a module body. Importing this module
// first guarantees the environment is populated before anything else reads it.
dotenv.config()

// ─── Required Environment Variables ────────────────────────────
// Validated *here* rather than in server.ts's body: `import { prisma } from
// './utils/prismaClient.js'` is hoisted and constructs a PrismaClient during
// module evaluation, which happens before server.ts's body runs. Validating in
// server.ts would therefore let Prisma throw an opaque construction error before
// we could report the actual cause.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const

const isProduction = process.env.NODE_ENV === 'production'

if (!process.env.JWT_SECRET) {
  if (isProduction) {
    // Never start production with a known/predictable signing key — the hardcoded
    // development fallback below would let anyone forge JWTs. Refuse to boot.
    process.stderr.write(
      'FATAL [startup] JWT_SECRET is required in production. Refusing to start with a fallback secret.\n' +
      'Set JWT_SECRET in the hosting panel and redeploy.\n',
    )
    process.exit(1)
  }
  process.stderr.write(
    'WARN [startup] JWT_SECRET not set in environment. Using development fallback secret (local dev only).\n',
  )
  process.env.JWT_SECRET = '2b83abcc07ed401b23fff63cb06ca816464e8b4a4110adc53640cbc97aac49f8'
}

// In production the frontend URL and CORS origin drive PayPal return URLs,
// password-reset links, emails and CORS. Warn loudly instead of silently
// falling back to localhost, which would break those flows.
if (isProduction) {
  for (const urlVar of ['FRONTEND_URL', 'CORS_ORIGIN'] as const) {
    const value = process.env[urlVar]
    if (!value || /^https?:\/\/localhost(?:[:/]|$)/.test(value)) {
      process.stderr.write(
        `WARN [startup] ${urlVar} is missing or points at localhost in production — ` +
        'PayPal return URLs, emails and CORS will be incorrect.\n',
      )
    }
  }
}

// ─── Frontend URL Resolver ───────────────────────────────────────
// Production must NEVER fall back to localhost, or PayPal return URLs,
// password-reset links and email buttons would point at the admin's machine.
// Dev keeps the localhost fallback for local testing.
//
// On Railway the frontend URL changes per deploy (*.railway.app), so
// FRONTEND_URL must be set explicitly in production. If it is missing we
// still refuse localhost but fall back to a placeholder that is obviously
// wrong — this fails loudly rather than silently sending buyers to the
// wrong place.
export function getFrontendUrl(): string {
  const explicit = process.env.FRONTEND_URL?.trim()
  if (explicit) return explicit
  if (isProduction) {
    // No FRONTEND_URL set in production — this is a misconfiguration.
    // Use a clearly-wrong placeholder so broken links stand out in logs.
    return 'https://frontend-not-configured.railway.app'
  }
  return 'http://localhost:5173'
}

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v])
if (missingVars.length > 0) {
  // Written to stderr rather than through pino: the logger writes to stdout, so a
  // platform that only surfaces stderr.log would show an empty file for a fatal
  // startup error.
  process.stderr.write(
    `FATAL [startup] missing required environment variables: ${missingVars.join(', ')}\n` +
    'Set them in your hosting panel (or .env locally) and redeploy.\n',
  )
  process.exit(1)
}
