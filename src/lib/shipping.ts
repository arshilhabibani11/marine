/**
 * Shipping-zone pricing for the storefront checkout display estimate. The
 * authoritative charge is recalculated server-side in backend/src/utils/shipping.ts
 * (which mirrors this logic) — the client value is never trusted for pricing.
 */
import { countries } from '../data/countries'

export interface ShippingZone {
  id?: string
  name?: string
  regions?: string[]
  rateType?: string
  flatRate?: number
  freeThreshold?: number
  estimatedDays?: string
  active?: boolean
}

const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(
  countries.map((c) => [c.value, c.label]),
)

// Common zone spellings that differ from the country label.
const REGION_ALIASES: Record<string, string> = {
  usa: 'united states',
  'united states of america': 'united states',
  uk: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  uae: 'uae',
  'united arab emirates': 'uae',
}

function normalizeRegion(value: string): string {
  const key = value.trim().toLowerCase()
  return REGION_ALIASES[key] ?? key
}

/** The setting is stored as a JSON string (how the admin saves it); accept an array too. */
export function parseShippingZones(raw: unknown): ShippingZone[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? (value as ShippingZone[]) : []
}

export function findZoneForCountry(zones: ShippingZone[], country: string): ShippingZone | undefined {
  const code = (country || '').trim().toUpperCase()
  const candidates = new Set<string>()
  if (country) candidates.add(normalizeRegion(country))
  if (code) candidates.add(normalizeRegion(code))
  const label = COUNTRY_LABELS[code]
  if (label) candidates.add(normalizeRegion(label))

  return zones.find(
    (zone) =>
      zone.active !== false &&
      Array.isArray(zone.regions) &&
      zone.regions.some((region) => typeof region === 'string' && candidates.has(normalizeRegion(region))),
  )
}

export function calcShippingCost(params: {
  subtotal: number
  country: string
  zones: ShippingZone[]
  baseShippingCost: number
  freeShippingThreshold: number
}): number {
  const { subtotal, country, zones, baseShippingCost, freeShippingThreshold } = params
  const zone = findZoneForCountry(zones, country)

  if (zone) {
    if (zone.rateType === 'free') return 0
    const zoneThreshold = Number(zone.freeThreshold) || 0
    if (zoneThreshold > 0 && subtotal >= zoneThreshold) return 0
    return Number(zone.flatRate) || 0
  }

  return freeShippingThreshold > 0 && subtotal >= freeShippingThreshold ? 0 : baseShippingCost
}
