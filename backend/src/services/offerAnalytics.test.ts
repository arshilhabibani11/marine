/**
 * Unit tests for offer analytics math (pure module, G46).
 * Run: cd backend && npx tsx --test src/services/offerAnalytics.test.ts
 *
 * Dates are fixed UTC instants so day-bucketing tests are deterministic.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeOfferSnapshot,
  bucketOffersByDay,
  topProducts,
  topRequesters,
  flagBurstRequesters,
  type AnalyticsOffer,
} from './offerAnalytics.js'

const T0 = new Date('2026-10-01T10:00:00Z') // Thursday
const T1 = new Date('2026-09-30T09:00:00Z') // previous UTC day
const T2 = new Date('2026-10-01T11:30:00Z') // 1.5h after T0

function offer(overrides: Partial<AnalyticsOffer>): AnalyticsOffer {
  return {
    status: 'pending',
    offeredPrice: 40,
    counterPrice: null,
    acceptedPrice: null,
    quantity: 1,
    createdAt: T0,
    respondedAt: null,
    productId: 'p1',
    productName: 'Scupper Plug',
    productSku: 'SP-1',
    customerEmail: 'buyer@example.com',
    ...overrides,
  }
}

// ─── Snapshot ─────────────────────────────────────────────────

test('snapshot counts statuses and derives open/decided split', () => {
  const s = computeOfferSnapshot([
    offer({ status: 'pending' }),
    offer({ status: 'pending' }),
    offer({ status: 'countered' }),
    offer({ status: 'accepted' }),
    offer({ status: 'paid' }),
    offer({ status: 'rejected' }),
    offer({ status: 'expired' }),
  ])
  assert.equal(s.total, 7)
  assert.equal(s.openCount, 3)
  assert.equal(s.decidedCount, 4)
  assert.equal(s.acceptedOrPaidCount, 2)
  assert.equal(s.rejectedCount, 1)
  assert.equal(s.byStatus.pending, 2)
})

test('snapshot rates: acceptance + rejection over decided offers', () => {
  const s = computeOfferSnapshot([
    offer({ status: 'accepted' }),
    offer({ status: 'rejected' }),
    offer({ status: 'paid' }),
    offer({ status: 'expired' }),
  ])
  assert.equal(s.decidedCount, 4)
  assert.equal(s.acceptanceRate, 50) // accepted + paid = 2 of 4
  assert.equal(s.rejectionRate, 25)
})

test('snapshot rates are null when nothing was decided', () => {
  const s = computeOfferSnapshot([offer({ status: 'pending' })])
  assert.equal(s.acceptanceRate, null)
  assert.equal(s.rejectionRate, null)
})

test('snapshot averages admin response hours over decided offers with timestamps', () => {
  const s = computeOfferSnapshot([
    offer({ status: 'accepted', respondedAt: T2 }), // 1.5h
    offer({ status: 'rejected', respondedAt: new Date('2026-10-01T16:00:00Z') }), // 6h
    offer({ status: 'pending', respondedAt: T2 }), // open → excluded
    offer({ status: 'accepted' }), // no timestamp → excluded
  ])
  // (1.5 + 6) / 2 = 3.75 → displayed at 1-decimal precision
  assert.equal(s.avgResponseHours, 3.8)
})

test('negotiated value prefers acceptedPrice then counter then offered, × quantity', () => {
  const s = computeOfferSnapshot([
    offer({ status: 'paid', offeredPrice: 40, counterPrice: 50, acceptedPrice: 48, quantity: 2 }),
    offer({ status: 'accepted', offeredPrice: 40, counterPrice: 55, quantity: 1 }),
    offer({ status: 'converted-to-order', offeredPrice: 30, quantity: 3 }),
    offer({ status: 'pending', offeredPrice: 999, quantity: 1 }), // not committed
  ])
  // 48×2 + 55×1 + 30×3 = 96 + 55 + 90
  assert.equal(s.totalNegotiatedValue, 241)
  assert.equal(s.negotiatedCount, 3)
})

// ─── Day buckets ──────────────────────────────────────────────

test('day buckets are zero-filled across the window and count per UTC day', () => {
  const buckets = bucketOffersByDay(
    [offer({}), offer({}), offer({ createdAt: T1 })],
    3,
    T0,
  )
  assert.deepEqual(buckets, [
    { date: '2026-09-29', count: 0 },
    { date: '2026-09-30', count: 1 },
    { date: '2026-10-01', count: 2 },
  ])
})

test('offers outside the window never create extra buckets', () => {
  const buckets = bucketOffersByDay([offer({ createdAt: new Date('2026-09-01T00:00:00Z') })], 3, T0)
  assert.equal(buckets.length, 3)
  assert.ok(buckets.every((b) => b.count === 0))
})

// ─── Top lists ────────────────────────────────────────────────

test('topProducts ranks by count, breaks ties alphabetically, honors limit', () => {
  const list = topProducts(
    [
      offer({ productId: 'p1', productName: 'Zeta Valve' }),
      offer({ productId: 'p2', productName: 'Alpha Pump', customerEmail: 'b@example.com' }),
      offer({ productId: 'p2', productName: 'Alpha Pump' }),
      offer({ productId: 'p3', productName: 'Mid Hose' }),
    ],
    2,
  )
  assert.deepEqual(list, [
    { key: 'p2', label: 'Alpha Pump', count: 2 },
    { key: 'p3', label: 'Mid Hose', count: 1 },
  ])
})

test('topProducts ignores offers without a product link', () => {
  const list = topProducts([offer({ productId: null })], 5)
  assert.equal(list.length, 0)
})

test('topRequesters aggregates per email', () => {
  const list = topRequesters(
    [
      offer({ customerEmail: 'a@x.com' }),
      offer({ customerEmail: 'a@x.com' }),
      offer({ customerEmail: 'b@x.com' }),
    ],
    5,
  )
  assert.deepEqual(list, [
    { key: 'a@x.com', label: 'a@x.com', count: 2 },
    { key: 'b@x.com', label: 'b@x.com', count: 1 },
  ])
})

// ─── Burst flags ──────────────────────────────────────────────

test('burst flags: watch vs high severity, window respected, sorted by volume', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const fresh = (n: number, email: string) =>
    Array.from({ length: n }, (_, i) => offer({ customerEmail: email, createdAt: new Date(now.getTime() - (i + 1) * 60_000) }))

  const flags = flagBurstRequesters(
    [
      ...fresh(10, 'flood@x.com'), // high
      ...fresh(5, 'watch@x.com'), // watch
      offer({ customerEmail: 'quiet@x.com', createdAt: new Date(now.getTime() - 48 * 3_600_000) }), // outside 24h
    ],
    now,
  )
  assert.equal(flags.length, 2)
  assert.equal(flags[0].email, 'flood@x.com')
  assert.equal(flags[0].severity, 'high')
  assert.equal(flags[1].email, 'watch@x.com')
  assert.equal(flags[1].severity, 'watch')
})

test('burst flags stay empty under normal pressure', () => {
  const flags = flagBurstRequesters(
    [offer({}), offer({ customerEmail: 'other@x.com' })],
    T0,
  )
  assert.equal(flags.length, 0)
})
