/**
 * Unit tests for the Make-an-Offer business rules (pure module).
 * Run: cd backend && npx tsx --test src/services/offerRules.test.ts
 *
 * Uses node:test — the project ships no unit-test framework and adding one is
 * explicitly out of scope. Money comparisons are exact on purpose: the rules
 * module only forwards amounts (Prisma Decimal → Number) and never computes.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptedAmountOf,
  canDecide,
  isPayableStatus,
  isPaymentWindowExpired,
  checkOfferEligibility,
  eligibilityMessage,
  OFFER_PAYMENT_WINDOW_MS,
  OPEN_DECISION_STATUSES,
} from './offerRules.js'

// ─── TEST_004/005/020: negotiated vs listed price separation ──

test('acceptedAmountOf uses the customer amount when no counter exists', () => {
  assert.equal(acceptedAmountOf({ offeredPrice: 45 }), 45)
})

test('acceptedAmountOf supersedes the customer amount with an admin counter', () => {
  assert.equal(acceptedAmountOf({ offeredPrice: 45, counterPrice: 55 }), 55)
})

test('acceptedAmountOf ignores non-positive counters', () => {
  assert.equal(acceptedAmountOf({ offeredPrice: 45, counterPrice: 0 }), 45)
  assert.equal(acceptedAmountOf({ offeredPrice: 45, counterPrice: null }), 45)
})

test('acceptedAmountOf forwards Decimal-backed amounts exactly (money convention: Number)', () => {
  assert.equal(acceptedAmountOf({ offeredPrice: '75.00', counterPrice: '45.00' }), 45)
})

// ─── State machine guards (TEST_009/010/011) ──────────────────

test('pending and countered are the only decidable statuses', () => {
  for (const status of ['pending', 'countered']) {
    assert.equal(canDecide(status, 'accept'), true, `${status} must be acceptable`)
  }
  for (const status of ['accepted', 'awaiting-payment', 'paid', 'rejected', 'expired', 'converted-to-order']) {
    assert.equal(canDecide(status, 'accept'), false, `${status} must not be acceptable twice`)
  }
})

test('rejected and expired offers can never be accepted (no REJECTED -> PAID path)', () => {
  for (const status of ['rejected', 'expired', 'paid', 'cancelled-ish']) {
    assert.equal(canDecide(status, 'accept'), false)
    assert.equal(canDecide(status, 'counter'), false)
    assert.equal(canDecide(status, 'reject'), false)
  }
})

test('only accepted/awaiting-payment offers are payable (TEST_009/010)', () => {
  assert.equal(isPayableStatus('accepted'), true)
  assert.equal(isPayableStatus('awaiting-payment'), true)
  for (const status of ['pending', 'countered', 'rejected', 'paid', 'expired']) {
    assert.equal(isPayableStatus(status), false)
  }
})

// ─── Payment window (TEST_010, TEST_019 timing side) ──────────

test('lapsed accepted offers report an expired payment window', () => {
  const acceptedAt = new Date('2026-01-01T10:00:00Z')
  const now = new Date(acceptedAt.getTime() + OFFER_PAYMENT_WINDOW_MS + 1)
  assert.equal(isPaymentWindowExpired({ status: 'accepted', acceptedAt, expiresAt: null, now }), true)
})

test('within the window the offer stays payable', () => {
  const acceptedAt = new Date('2026-01-01T10:00:00Z')
  const now = new Date(acceptedAt.getTime() + OFFER_PAYMENT_WINDOW_MS - 60_000)
  assert.equal(isPaymentWindowExpired({ status: 'accepted', acceptedAt, expiresAt: null, now }), false)
})

test('pending offers never expire through the payment window', () => {
  const now = new Date()
  assert.equal(isPaymentWindowExpired({ status: 'pending', acceptedAt: null, expiresAt: now, now }), false)
})

test('an explicit expiresAt deadline is honored', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.equal(
    isPaymentWindowExpired({ status: 'awaiting-payment', acceptedAt: new Date('2026-05-01T00:00:00Z'), expiresAt: new Date('2026-05-02T00:00:00Z'), now }),
    true,
  )
})

// ─── Eligibility (TEST_002/023 server authority) ──────────────

const eligibleProduct = {
  makeOfferEnabled: true,
  showPrice: true,
  status: 'published',
  availability: 'in-stock',
  stockCount: 1,
  minimumOfferPrice: null,
  requestedQuantity: 1,
  offeredAmount: 45,
  regularPrice: 75,
}

test('eligible product + valid offer passes', () => {
  assert.equal(checkOfferEligibility(eligibleProduct), null)
})

test('offers are rejected for products without makeOfferEnabled', () => {
  assert.equal(checkOfferEligibility({ ...eligibleProduct, makeOfferEnabled: false }), 'product_not_eligible')
})

test('offers are rejected for unpublished or hidden-price products', () => {
  assert.equal(checkOfferEligibility({ ...eligibleProduct, status: 'draft' }), 'product_not_eligible')
  assert.equal(checkOfferEligibility({ ...eligibleProduct, showPrice: false }), 'product_hidden')
})

test('offers are rejected on out-of-stock products (TEST_015 upstream)', () => {
  assert.equal(checkOfferEligibility({ ...eligibleProduct, availability: 'out-of-stock' }), 'product_unavailable')
  assert.equal(checkOfferEligibility({ ...eligibleProduct, stockCount: 0 }), 'product_unavailable')
})

test('offers exceeding stock are rejected', () => {
  assert.equal(checkOfferEligibility({ ...eligibleProduct, requestedQuantity: 2 }), 'quantity_exceeds_stock')
})

test('offers below the configured minimum are rejected (TEST_002)', () => {
  assert.equal(
    checkOfferEligibility({ ...eligibleProduct, minimumOfferPrice: 50, offeredAmount: 45 }),
    'offer_below_minimum',
  )
})

test('invalid amounts are rejected (TEST_007/023: client amounts are input only)', () => {
  assert.equal(checkOfferEligibility({ ...eligibleProduct, offeredAmount: 0 }), 'amount_invalid')
  assert.equal(checkOfferEligibility({ ...eligibleProduct, offeredAmount: -5 }), 'amount_invalid')
  assert.equal(checkOfferEligibility({ ...eligibleProduct, offeredAmount: Number.NaN }), 'amount_invalid')
})

test('every ineligibility reason maps to a customer-safe message', () => {
  const reasons = [
    'product_not_eligible', 'product_hidden', 'product_unavailable',
    'quantity_exceeds_stock', 'offer_below_minimum', 'amount_invalid',
  ] as const
  for (const reason of reasons) {
    assert.equal(typeof eligibilityMessage(reason), 'string')
    assert.ok(eligibilityMessage(reason).length > 0)
  }
})

test('OPEN_DECISION_STATUSES matches the guarded transition table', () => {
  for (const status of OPEN_DECISION_STATUSES) {
    assert.equal(canDecide(status, 'accept'), true)
  }
  assert.equal(OPEN_DECISION_STATUSES.length, 2)
})
