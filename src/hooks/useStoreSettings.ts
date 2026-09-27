import { useState, useEffect } from 'react'
import { storefront } from '../lib/api'
import { parseShippingZones, type ShippingZone } from '../lib/shipping'

export interface PaymentMethodSetting {
  id?: string
  name?: string
  type?: string
  enabled?: boolean
  testMode?: boolean
  config?: Record<string, string>
}

interface StoreSettings {
  whatsappNumber: string
  shippingCost: number
  taxRate: number
  freeShippingThreshold: number
  rfqEmail: string
  emergencyEmail: string
  phoneNumber: string
  googleAnalyticsId: string
  maintenanceMode: boolean
  shippingZones: ShippingZone[]
  paymentMethods: PaymentMethodSetting[]
}

const DEFAULTS: StoreSettings = {
  whatsappNumber: '918799095041',
  shippingCost: 25,
  taxRate: 0.08,
  freeShippingThreshold: 100,
  rfqEmail: 'sales@alkatraders.co',
  emergencyEmail: 'sales@alkatraders.co',
  phoneNumber: '+918799095041',
  googleAnalyticsId: '',
  maintenanceMode: false,
  shippingZones: [],
  paymentMethods: [],
}

/** Same shape the admin saves under `store.paymentMethods` (a JSON string). */
function parsePaymentMethods(raw: unknown): PaymentMethodSetting[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? (value as PaymentMethodSetting[]) : []
}

let cachedSettings: StoreSettings = { ...DEFAULTS }
let fetchPromise: Promise<StoreSettings> | null = null

// Track settings subscribers so we can notify them on retry
let subscribers: Array<(s: StoreSettings) => void> = []

function notifySubscribers(settings: StoreSettings) {
  subscribers.forEach(fn => fn(settings))
}

async function fetchSettingsAndNotify(): Promise<StoreSettings> {
  if (fetchPromise) return fetchPromise
  fetchPromise = storefront.settings()
    .then((res) => {
      const s = res.settings || {}
      cachedSettings = {
        whatsappNumber: String(s['site.whatsappNumber'] || DEFAULTS.whatsappNumber),
        shippingCost: Number(s['checkout.shippingCost']) || DEFAULTS.shippingCost,
        taxRate: Number(s['checkout.taxRate']) || DEFAULTS.taxRate,
        freeShippingThreshold: Number(s['checkout.freeShippingThreshold']) || DEFAULTS.freeShippingThreshold,
        rfqEmail: String(s['site.rfqEmail'] || DEFAULTS.rfqEmail),
        emergencyEmail: String(s['site.emergencyEmail'] || DEFAULTS.emergencyEmail),
        phoneNumber: String(s['site.phoneNumber'] || DEFAULTS.phoneNumber),
        googleAnalyticsId: String(s['site.googleAnalyticsId'] || DEFAULTS.googleAnalyticsId),
        maintenanceMode: s['site.maintenanceMode'] === true || s['site.maintenanceMode'] === 'true',
        shippingZones: parseShippingZones(s['store.shippingZones']),
        paymentMethods: parsePaymentMethods(s['store.paymentMethods']),
      }
      notifySubscribers(cachedSettings)
      return cachedSettings
    })
    .catch(() => {
      fetchPromise = null
      return DEFAULTS
    })
    .finally(() => {
      fetchPromise = null
    })
  return fetchPromise
}

export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(cachedSettings)

  useEffect(() => {
    subscribers.push(setSettings)
    fetchSettingsAndNotify()
    return () => {
      subscribers = subscribers.filter(fn => fn !== setSettings)
    }
  }, [])

  return settings
}
