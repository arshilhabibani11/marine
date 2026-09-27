import type { Request } from 'express'
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit'
import type { AuthRequest } from './auth.js'

// ─── Per-User Rate Limiter ─────────────────────────────────────
// Uses req.user?.id when available (authenticated requests),
// falls back to IP address for unauthenticated requests.
// This prevents one user from exhausting another user's quota
// behind a shared IP (e.g., corporate NAT).

export function createUserAwareLimiter(options: {
  windowMs: number
  max: number
  message?: string
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: options.message || 'Too many requests, please try again later.' },
    keyGenerator: (req: Request) => {
      const authReq = req as AuthRequest
      // Use user ID if authenticated, fall back to IP
      if (authReq.user?.id) {
        return `user:${authReq.user.id}`
      }
      // IP-based key for unauthenticated requests — `req.ip` is trust-proxy aware
      // (see `app.set('trust proxy', 1)`), whereas the raw X-Forwarded-For header
      // is client-spoofable and would let a caller rotate buckets.
      return req.ip || req.socket.remoteAddress || 'unknown'
    },
  })
}
