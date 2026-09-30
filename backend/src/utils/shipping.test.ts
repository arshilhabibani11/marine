/**
 * Unit tests for the shipping-zone pricing utils (roadmap E38).
 * Run: cd backend && npx tsx --test src/utils/shipping.test.ts
 *
 * node:test, pure module — no DB/server imports (house convention). These pin
 * the checkout pricing rules: zone authority, free thresholds, fallback rate,
 * and country-code/label matching used by the admin-configured zones.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { calcShippingCost, parseShippingZones, findZoneForCountry, type ShippingZone } from './shipping.js'

const zone = (overrides: Partial<ShippingZone>): ShippingZone => ({
  name: 'Test zone',
  regions: ['US'],
  rateType: 'flat',
  flatRate: 12.5,
  freeThreshold: 0,
  active: true,
  ...overrides,
})

const base = {
  subtotal: 50,
  country: 'US',
  zones: [] as ShippingZone[],
  baseShippingCost: 25,
  freeShippingThreshold: 100,
}

// ── parseShippingZones ─────────────────────────────────────────

test('parseShippingZones parses the stored JSON string', () => {
  const raw = JSON.stringify([{ name: 'Z', regions: ['US'] }])
  assert.equal(parseShippingZones(raw).length, 1)
})

test('parseShippingZones returns [] on invalid JSON and non-arrays', () => {
  assert.deepEqual(parseShippingZones('{not json'), [])
  assert.deepEqual(parseShippingZones({ nope: true }), [])
  assert.deepEqual(parseShippingZones(null), [])
})

// ── findZoneForCountry matching ────────────────────────────────

test('findZoneForCountry matches codes, names, and aliases (one-directional code→label map)', () => {
  const byCode = [zone({ regions: ['US'] })]
  assert.ok(findZoneForCountry(byCode, 'US'))
  assert.ok(findZoneForCountry(byCode, 'us'))
  assert.equal(findZoneForCountry(byCode, 'DE'), undefined)
  // A full-name input does NOT map back to the code — zones storing codes
  // only match code-ish inputs.
  assert.equal(findZoneForCountry(byCode, 'United States'), undefined)

  const byName = [zone({ regions: ['United States'] })]
  assert.ok(findZoneForCountry(byName, 'US')) // code input resolves to the label
  assert.ok(findZoneForCountry(byName, 'United States'))

  const byAlias = [zone({ regions: ['USA'] })]
  assert.ok(findZoneForCountry(byAlias, 'US')) // 'usa' alias → 'united states' (label)
  assert.ok(findZoneForCountry(byAlias, 'USA'))
})

// ── calcShippingCost: zone authority ───────────────────────────

test('zone flat rate wins over the base rate', () => {
  const cost = calcShippingCost({ ...base, zones: [zone({ flatRate: 12.5 })] })
  assert.equal(cost, 12.5)
})

test('zone with rateType free costs nothing', () => {
  const cost = calcShippingCost({ ...base, zones: [zone({ rateType: 'free', flatRate: 12.5 })] })
  assert.equal(cost, 0)
})

test('zone free threshold met → free', () => {
  const cost = calcShippingCost({ ...base, subtotal: 150, zones: [zone({ freeThreshold: 100 })] })
  assert.equal(cost, 0)
})

test('zone free threshold NOT met → zone flat rate (not the global threshold)', () => {
  const cost = calcShippingCost({ ...base, subtotal: 50, zones: [zone({ flatRate: 8, freeThreshold: 100 })] })
  assert.equal(cost, 8)
})

test('inactive zones are skipped', () => {
  const cost = calcShippingCost({ ...base, zones: [zone({ active: false })] })
  assert.equal(cost, 25) // falls through to the base rate
})

// ── calcShippingCost: no-zone fallback ─────────────────────────

test('no matching zone → base shipping cost', () => {
  assert.equal(calcShippingCost(base), 25)
})

test('no zone + subtotal ≥ global threshold → free', () => {
  assert.equal(calcShippingCost({ ...base, subtotal: 150 }), 0)
})

test('first matching zone wins when several match', () => {
  const cost = calcShippingCost({
    ...base,
    zones: [zone({ name: 'A', flatRate: 5 }), zone({ name: 'B', flatRate: 9 })],
  })
  assert.equal(cost, 5)
})
