/**
 * eBay order processing tests (roadmap C32).
 * Run: cd backend && npx tsx --test src/services/ebayOrderService.test.ts
 *
 * node:test, matching the project's offerRules test convention. The full DB
 * flows (stock claim, duplicate events) are covered by the smoke script
 * against a live server; these tests pin the pure decision logic and the
 * idempotency semantics of the processor's pure parts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractOrderId, extractEventId } from './ebayOrderEvents.js'
import { isRetryableError } from './ebayClient.js'

// ── extractOrderId across notification shapes ──────────────────

test('extractOrderId reads the direct orderId', () => {
  assert.equal(extractOrderId({ orderId: '12-34567-89012' }), '12-34567-89012')
})

test('extractOrderId reads snake_case order_id', () => {
  assert.equal(extractOrderId({ order_id: '12-34567-89012' }), '12-34567-89012')
})

test('extractOrderId reads nested data.orderId', () => {
  assert.equal(extractOrderId({ data: { orderId: '12-1' } }), '12-1')
})

test('extractOrderId reads nested resource.orderId', () => {
  assert.equal(extractOrderId({ resource: { orderId: '12-2' } }), '12-2')
})

test('extractOrderId returns undefined when absent', () => {
  assert.equal(extractOrderId({ foo: 'bar' }), undefined)
})

test('extractEventId prefers notificationId', () => {
  assert.equal(extractEventId({ notificationId: 'abc-1', eventId: 'x' }), 'abc-1')
})

// ── retry classification drives the defer-vs-fail split ────────

test('isRetryableError: 5xx and 429 are temporary', () => {
  assert.equal(isRetryableError(new Error('eBay getOrder failed (503): busy')), true)
  assert.equal(isRetryableError(new Error('eBay updateOffer failed (429): rate limited')), true)
})

test('isRetryableError: network errors are temporary', () => {
  assert.equal(isRetryableError(new Error('fetch failed: ECONNRESET')), true)
  assert.equal(isRetryableError(new Error('ETIMEDOUT')), true)
})

test('isRetryableError: 404 and validation errors are permanent', () => {
  assert.equal(isRetryableError(new Error('eBay getOrder failed (404): not found')), false)
  assert.equal(isRetryableError(new Error('eBay updateOffer failed (400): bad request')), false)
})
