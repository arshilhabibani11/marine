/**
 * Pure eBay notification helpers (no Prisma/server imports — unit-testable
 * per the project's pure-module test convention, like offerRules.ts).
 */

/** Extract the eBay order id from a notification payload across topic shapes. */
export function extractOrderId(payload: Record<string, unknown>): string | undefined {
  const direct = payload.orderId
  if (typeof direct === 'string' && direct) return direct
  const snake = payload.order_id
  if (typeof snake === 'string' && snake) return snake
  const nested = payload.data as { orderId?: unknown } | undefined
  if (nested && typeof nested.orderId === 'string' && nested.orderId) return nested.orderId
  const resource = payload.resource as { orderId?: unknown } | undefined
  if (resource && typeof resource.orderId === 'string' && resource.orderId) return resource.orderId
  return undefined
}

/** Extract the notification/event id used for idempotency. */
export function extractEventId(payload: Record<string, unknown>): string | undefined {
  const n = payload.notificationId
  if (typeof n === 'string' && n) return n
  const e = payload.eventId
  if (typeof e === 'string' && e) return e
  return undefined
}
