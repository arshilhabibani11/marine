/**
 * A refund is recorded on `paymentStatus`, not `status` — the backend order
 * status enum is pending/confirmed/paid/processing/packed/shipped/delivered/
 * cancelled, and never becomes "refunded". Keep that distinction in one place
 * so analytics widgets don't each have to remember it.
 */

export interface OrderLike {
  status?: string
  paymentStatus?: string
}

export function isRefundedOrder(order: OrderLike): boolean {
  return order.status === 'refunded' || order.paymentStatus === 'refunded'
}

/** Cancelled or refunded — i.e. an order that should not count as realized revenue. */
export function isCancelledOrRefunded(order: OrderLike): boolean {
  return order.status === 'cancelled' || isRefundedOrder(order)
}
