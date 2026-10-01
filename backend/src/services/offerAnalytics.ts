/**
 * Offer analytics (group G46) — pure aggregation math, no Prisma, no Express.
 *
 * Dependency-free like offerRules.ts so the numbers can be unit-tested
 * without a database. The admin service feeds real rows in (already scoped
 * to a time window); this module only computes.
 *
 * Money rule mirrors the rest of the codebase: this module only forwards
 * amounts (Prisma Decimal → Number) via acceptedAmountOf semantics and never
 * invents prices. The negotiated value of an offer is what the customer
 * would pay: acceptedPrice ?? counterPrice ?? offeredPrice, times quantity.
 */
import { acceptedAmountOf } from './offerRules.js'

/** Minimal offer shape the service passes in (subset of the Prisma model). */
export interface AnalyticsOffer {
  status: string
  offeredPrice: unknown
  counterPrice?: unknown | null
  acceptedPrice?: unknown | null
  quantity: number
  createdAt: Date
  respondedAt?: Date | null
  productId?: string | null
  productName?: string | null
  productSku?: string | null
  customerEmail: string
}

export interface OfferSnapshot {
  total: number
  byStatus: Record<string, number>
  openCount: number
  /** decided = accepted/paid/converted/rejected/expired — open ones excluded. */
  decidedCount: number
  acceptedOrPaidCount: number
  rejectedCount: number
  acceptanceRate: number | null
  rejectionRate: number | null
  /** Mean hours from submission to first admin response (decided offers). */
  avgResponseHours: number | null
  /** Sum of (negotiated unit × quantity) over accepted/awaiting/paid/converted offers. */
  totalNegotiatedValue: number
  negotiatedCount: number
}

/** Statuses that count as "committed" when valuing the pipeline. */
const COMMITTED_STATUSES = ['accepted', 'awaiting-payment', 'paid', 'converted-to-order']
const OPEN_STATUSES = ['pending', 'countered']
const DECIDED_STATUSES = ['accepted', 'awaiting-payment', 'paid', 'converted-to-order', 'rejected', 'expired']

function num(v: unknown): number {
  return v == null ? 0 : Number(v)
}

/** Round to 1 decimal — rates and hours are display numbers, not money. */
function round1(v: number): number {
  return Math.round(v * 10) / 10
}

export function computeOfferSnapshot(offers: AnalyticsOffer[]): OfferSnapshot {
  const byStatus: Record<string, number> = {}
  let acceptedOrPaid = 0
  let decided = 0
  let rejected = 0
  let responseHoursSum = 0
  let responseCount = 0
  let negotiatedValue = 0
  let negotiatedCount = 0

  for (const o of offers) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1

    if (o.status === 'paid' || o.status === 'accepted') acceptedOrPaid += 1
    if (DECIDED_STATUSES.includes(o.status)) {
      decided += 1
      if (o.respondedAt) {
        const h = (o.respondedAt.getTime() - o.createdAt.getTime()) / 3_600_000
        if (h >= 0) {
          responseHoursSum += h
          responseCount += 1
        }
      }
    }
    if (o.status === 'rejected') rejected += 1
    if (COMMITTED_STATUSES.includes(o.status)) {
      // acceptedPrice is the amount actually agreed; otherwise fall back to
      // counter-then-offered (acceptedAmountOf semantics), × quantity.
      const agreed = num(o.acceptedPrice) > 0 ? num(o.acceptedPrice) : acceptedAmountOf({ offeredPrice: o.offeredPrice, counterPrice: o.counterPrice })
      negotiatedValue += Math.round(agreed * o.quantity * 100) / 100
      negotiatedCount += 1
    }
  }

  return {
    total: offers.length,
    byStatus,
    openCount: OPEN_STATUSES.reduce((s, k) => s + (byStatus[k] || 0), 0),
    decidedCount: decided,
    acceptedOrPaidCount: acceptedOrPaid,
    rejectedCount: rejected,
    acceptanceRate: decided > 0 ? round1((acceptedOrPaid / decided) * 100) : null,
    rejectionRate: decided > 0 ? round1((rejected / decided) * 100) : null,
    avgResponseHours: responseCount > 0 ? round1(responseHoursSum / responseCount) : null,
    totalNegotiatedValue: Math.round(negotiatedValue * 100) / 100,
    negotiatedCount,
  }
}

export interface DayBucket {
  date: string // YYYY-MM-DD (UTC)
  count: number
}

/**
 * Zero-filled per-day offer counts for the trailing `days` window ending
 * `now` (default today). Deterministic: buckets are UTC days.
 */
export function bucketOffersByDay(offers: AnalyticsOffer[], days: number, now: Date = new Date()): DayBucket[] {
  const counts = new Map<string, number>()
  for (const o of offers) {
    const key = o.createdAt.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const buckets: DayBucket[] = []
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(end - i * 86_400_000).toISOString().slice(0, 10)
    buckets.push({ date: key, count: counts.get(key) || 0 })
  }
  return buckets
}

export interface TopEntry {
  key: string
  label: string
  count: number
}

/** Top-N products by offer volume (ties broken alphabetically for stability). */
export function topProducts(offers: AnalyticsOffer[], limit = 5): TopEntry[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const o of offers) {
    if (!o.productId) continue
    const label = o.productName || o.productSku || o.productId
    const prev = counts.get(o.productId)
    if (prev) prev.count += 1
    else counts.set(o.productId, { label, count: 1 })
  }
  return [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** Top-N requesters by email (abuse review + outreach both use this). */
export function topRequesters(offers: AnalyticsOffer[], limit = 5): TopEntry[] {
  const counts = new Map<string, number>()
  for (const o of offers) {
    counts.set(o.customerEmail, (counts.get(o.customerEmail) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export interface BurstFlag {
  email: string
  count: number
  windowHours: number
  /** True when the count reached the admin-configured offer ceiling scale. */
  severity: 'watch' | 'high'
}

/**
 * Flag emails whose submission rate inside the trailing window looks
 * scripted. Advisory only — the hard blocks live in offerRules/G47; this is
 * for the analytics view so admins can see pressure before limits trip.
 */
export function flagBurstRequesters(offers: AnalyticsOffer[], now: Date = new Date(), windowHours = 24, highThreshold = 10, watchThreshold = 5): BurstFlag[] {
  const windowMs = windowHours * 3_600_000
  const counts = new Map<string, number>()
  for (const o of offers) {
    if (now.getTime() - o.createdAt.getTime() <= windowMs) {
      counts.set(o.customerEmail, (counts.get(o.customerEmail) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= watchThreshold)
    .map(([email, count]) => ({
      email,
      count,
      windowHours,
      severity: count >= highThreshold ? ('high' as const) : ('watch' as const),
    }))
    .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
}
