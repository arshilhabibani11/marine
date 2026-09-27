import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit'

// ─── Brute-Force Protection for Auth Endpoints ───────────────
// Stricter than general publicLimiter:
// - Login: 5 attempts per 15 minutes per IP
// - Register: 3 attempts per hour per IP
// - Password reset: 3 attempts per 15 minutes per IP
//
// These rely on express-rate-limit's default keyGenerator (req.ip), which
// honours `app.set('trust proxy', 1)`. Parsing X-Forwarded-For by hand would
// take the client-supplied left-most value and let an attacker rotate a fake IP
// per request to bypass the limit entirely.

export const loginLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true, // Don't count successful logins against limit
})

export const registerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                    // 3 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
})

export const passwordResetLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,                    // 3 reset requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
})
