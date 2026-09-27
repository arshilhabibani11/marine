import NodeCache from 'node-cache'
import type { NextFunction, Request, Response } from 'express'

/**
 * In-memory GET response cache (node-cache).
 *
 * Only static, high-traffic, rarely-changing storefront endpoints are cached
 * (settings, categories, brands, industries).
 * Every hit skips the database entirely — critical on Neon's free tier, where
 * a cold-start database connection can take seconds. A 5-minute TTL bounds
 * staleness, and admin/auth/authenticated requests are never cached.
 */

const responseCache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 500 }) // 5 min TTL, 1 min cleanup, bounded to 500 keys

// Normalized paths (after stripping /api or /api/v1) eligible for caching.
const CACHEABLE_PATHS = [
  '/storefront/settings',
  '/storefront/categories',
  '/storefront/brands',
  '/storefront/industries',
]

function isCacheable(path: string): boolean {
  const normalized = path.replace(/^\/api\/v1/, '/api').replace(/^\/api/, '')
  return CACHEABLE_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))
}

interface CachedResponse {
  status: number
  body: unknown
}

export function cacheGet(req: Request, res: Response, next: NextFunction) {
  // GET-only, no auth, whitelisted path — otherwise pass straight through.
  if (
    req.method !== 'GET' ||
    req.headers.authorization ||
    req.headers['x-csrf-token'] ||
    !isCacheable(req.path)
  ) {
    return next()
  }

  const key = req.originalUrl
  const cached = responseCache.get<CachedResponse>(key)
  if (cached) {
    res.status(cached.status).json(cached.body)
    return
  }

  // Wrap res.json so the first response populates the cache for the TTL.
  // Only 2xx responses are cached — error responses are never stored, so a
  // transient 5xx cannot poison the cache for the rest of the TTL window.
  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      responseCache.set(key, { status: res.statusCode, body })
    }
    return originalJson(body)
  }) as typeof res.json

  next()
}

/** Exposed for tests / diagnostics — clear a single key or everything. */
export function clearCache(key?: string) {
  if (key) responseCache.del(key)
  else responseCache.flushAll()
}

/**
 * Invalidate every cached response for a storefront path. Keys are full
 * original URLs, so this matches across the `/api` and `/api/v1` prefixes and
 * ignores any query string — used when a mutation makes cached data stale
 * (e.g. admin settings save → `/storefront/settings`).
 */
export function invalidateCachePath(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`
  for (const key of responseCache.keys()) {
    const normalized = key
      .replace(/^\/api\/v1/, '/api')
      .replace(/^\/api/, '')
      .split('?')[0]
    if (normalized === target || normalized.startsWith(`${target}/`)) {
      responseCache.del(key)
    }
  }
}
