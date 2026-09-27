import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'

// JWT_SECRET availability is guaranteed by backend/src/utils/env.ts, which
// validates it at startup (refusing to boot in production without a real
// secret) before any module that reads it is loaded. The old module-load
// guard here was dead code and has been removed.
const JWT_SECRET = process.env.JWT_SECRET as string

export interface AuthUser {
  id: string
  email: string
  role: string
  type?: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

// ─── Authenticate Admin ────────────────────────────────────────
export function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    // P0: a customer JWT must never gain admin access. Customer and admin
    // tokens share the same secret, so the role must be checked explicitly.
    if (decoded.type === 'customer') {
      console.warn('[auth] Customer JWT rejected on admin route')
      return res.status(403).json({ error: 'Admin access required' })
    }
    req.user = decoded
    next()
  } catch {
    console.warn('[auth] Admin JWT verification failed')
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Authenticate Customer ─────────────────────────────────────
export function authenticateCustomer(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser & { type: string }
    if (decoded.type !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' })
    }
    req.user = decoded
    next()
  } catch {
    console.warn('[auth] Customer JWT verification failed')
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Optional Customer Auth (for guest checkout) ────────────
// Attempts to verify the customer JWT. If no token is present or it's
// invalid, req.user stays undefined — the route can proceed without auth.
export function optionalCustomerAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next() // No token — proceed as guest
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser & { type: string }
    if (decoded.type === 'customer') {
      req.user = decoded
    }
  } catch {
    // Invalid token — proceed as guest
  }
  next()
}

// ─── Require Role ──────────────────────────────────────────────
// requireRole() is a threshold check (userLevel >= requiredLevel), so two roles
// that share a level silently grant each other's permissions. `sales-agent`
// (customers/RFQs/offers) and `content-manager` (brand-logo) are independent
// domains and must not be equal, or each passes the other's routes.
const ROLE_HIERARCHY: Record<string, number> = {
  'owner': 6,
  'store-manager': 5,
  'inventory-manager': 4,
  'sales-agent': 3,
  'content-manager': 2,
  'viewer': 1,
}

export function requireRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

// ─── Require Owner ─────────────────────────────────────────────
export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' })
  }
  next()
}

// ─── Generate JWT ──────────────────────────────────────────────
export function generateToken(user: { id: string; email: string; role: string; type?: string }): string {
  const payload = { id: user.id, email: user.email, role: user.role, type: user.type || 'admin' }
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as unknown as SignOptions['expiresIn'] }
  return jwt.sign(payload, JWT_SECRET, options)
}

export function generateRefreshToken(user: { id: string; email: string; role: string; type?: string }): string {
  const payload = { id: user.id, email: user.email, role: user.role, type: user.type || 'admin', refresh: true }
  const options: SignOptions = { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as unknown as SignOptions['expiresIn'] }
  return jwt.sign(payload, JWT_SECRET, options)
}
