/**
 * Pure Make-an-Offer business rules — no Prisma, no Express.
 *
 * Kept dependency-free so the state machine and price rules can be unit
 * tested directly (backend tests run with `tsx --test`).
 *
 * Core invariants enforced everywhere else in the codebase:
 *  - The public product price is NEVER mutated by an offer. The negotiated
 *    price lives on the offer (acceptedPrice) and on the order
 *    (negotiatedPrice / originalListedPrice historical snapshot).
 *  - The payable amount is always computed server-side from stored data;
 *    the client sends identifiers only, never amounts.
 */

export const OFFER_PAYMENT_WINDOW_MS = 72 * 60 * 60 * 1000 // 72h to pay after acceptance

export const OFFER_CUSTOMER_STATUSES = [
  'pending',
  'countered',
  'accepted',
  'awaiting-payment',
  'paid',
  'rejected',
  'expired',
] as const
export type OfferCustomerStatus = (typeof OFFER_CUSTOMER_STATUSES)[number]

/** Offer statuses that can still be resolved by an admin decision. */
export const OPEN_DECISION_STATUSES = ['pending', 'countered'] as const

/** Admin actions allowed from each current status. */
const ADMIN_TRANSITIONS: Record<string, Record<'accept' | 'reject' | 'counter', boolean>> = {
  pending: { accept: true, reject: true, counter: true },
  countered: { accept: true, reject: true, counter: true },
  accepted: { accept: false, reject: false, counter: false },
  'awaiting-payment': { accept: false, reject: false, counter: false },
  paid: { accept: false, reject: false, counter: false },
  rejected: { accept: false, reject: false, counter: false },
  expired: { accept: false, reject: false, counter: false },
  'converted-to-order': { accept: false, reject: false, counter: false },
}

export type AdminOfferAction = keyof (typeof ADMIN_TRANSITIONS)['pending']

/**
 * The price the customer would actually pay if accepted right now:
 * an admin counter supersedes the customer's original amount.
 */
export function acceptedAmountOf(offer: { offeredPrice: unknown; counterPrice?: unknown | null }): number {
  const counter = offer.counterPrice == null ? null : Number(offer.counterPrice)
  return counter && counter > 0 ? counter : Number(offer.offeredPrice)
}

/**
 * Whether the offer's current status allows the given admin decision.
 * Terminal statuses (paid / expired / rejected / already accepted) never
 * transition again — this is what makes acceptance idempotent-by-guard.
 */
export function canDecide(status: string, action: AdminOfferAction): boolean {
  return ADMIN_TRANSITIONS[status]?.[action] === true
}

/** Whether a customer checkout may be started for this offer. */
export function isPayableStatus(status: string): boolean {
  return status === 'accepted' || status === 'awaiting-payment'
}

export interface OfferExpiryInput {
  status: string
  acceptedAt: Date | null
  expiresAt: Date | null
  now?: Date
}

/**
 * Whether the offer's payment window has lapsed (accepted offers carry a
 * deadline). Pending/countered leads keep their original expiresAt semantics
 * (a decision deadline), they do not auto-expire into 'expired' here.
 */
export function isPaymentWindowExpired(input: OfferExpiryInput): boolean {
  if (!isPayableStatus(input.status)) return false
  const now = input.now ?? new Date()
  const deadline = input.expiresAt ?? (input.acceptedAt ? new Date(input.acceptedAt.getTime() + OFFER_PAYMENT_WINDOW_MS) : null)
  return deadline != null && now.getTime() > deadline.getTime()
}

export interface OfferEligibilityInput {
  makeOfferEnabled: boolean
  showPrice: boolean
  status: string
  availability: string
  stockCount: number
  minimumOfferPrice: number | null
  requestedQuantity: number
  offeredAmount: number
  regularPrice: number
}

/** One reason string per failure, or null when eligible. */
export type OfferIneligibilityReason =
  | 'product_not_eligible'
  | 'product_hidden'
  | 'product_unavailable'
  | 'quantity_exceeds_stock'
  | 'offer_below_minimum'
  | 'amount_invalid'

export function checkOfferEligibility(input: OfferEligibilityInput): OfferIneligibilityReason | null {
  if (!input.makeOfferEnabled) return 'product_not_eligible'
  if (!input.showPrice) return 'product_hidden'
  if (input.status !== 'published' && input.status !== 'active') return 'product_not_eligible'
  if (input.availability === 'out-of-stock' || input.stockCount <= 0) return 'product_unavailable'
  if (input.requestedQuantity > input.stockCount) return 'quantity_exceeds_stock'
  if (!(input.offeredAmount > 0) || Number.isNaN(input.offeredAmount)) return 'amount_invalid'
  if (input.minimumOfferPrice != null && input.minimumOfferPrice > 0 && input.offeredAmount < input.minimumOfferPrice) {
    return 'offer_below_minimum'
  }
  return null
}

/** Human-readable message for storefront error responses (no internals). */
export function eligibilityMessage(reason: OfferIneligibilityReason): string {
  switch (reason) {
    case 'product_not_eligible': return 'This product does not accept offers'
    case 'product_hidden': return 'This product does not accept offers'
    case 'product_unavailable': return 'This product is currently unavailable'
    case 'quantity_exceeds_stock': return 'Requested quantity exceeds available stock'
    case 'offer_below_minimum': return 'Your offer is below the minimum accepted amount'
    case 'amount_invalid': return 'Invalid offer amount'
  }
}

// ─── Abuse guards (group G47) ─────────────────────────────────
// Pure decision logic: the service layer counts real rows and feeds the
// counts in. Keeping the rules dependency-free keeps them unit-testable
// without a database, same as the eligibility rules above.

/** Max simultaneously OPEN (pending/countered) offers per email. */
export const OFFER_MAX_OPEN_PER_EMAIL = 5
/** Max offers one email may submit per rolling 24h window. */
export const OFFER_MAX_PER_EMAIL_PER_DAY = 10
/** Max offers one IP may submit per rolling 24h window. Shared NATs
 *  (ship crews, offices) are common in this market → deliberately generous;
 *  this breaker stops scripted floods, not humans. */
export const OFFER_MAX_PER_IP_PER_DAY = 30

/** Open = awaiting an admin decision. Negotiating several RFUs is legitimate. */
export const OPEN_OFFER_STATUSES = ['pending', 'countered'] as const

/** Guard reason or null when the submission may proceed. */
export type OfferGuardReason = 'email_required' | 'too_many_open_offers' | 'email_rate_limited' | 'ip_rate_limited'

/**
 * Email may not open another offer while already holding the maximum number
 * of open ones — blocks mailbox-flooding without hurting real negotiations.
 */
export function checkOpenOfferLimit(email: string | null | undefined, openOfferCount: number): OfferGuardReason | null {
  if (!email) return 'email_required'
  if (openOfferCount >= OFFER_MAX_OPEN_PER_EMAIL) return 'too_many_open_offers'
  return null
}

/** Rolling 24h submission budget per email. `recentCount` counts offers this email created in the window. */
export function checkDailyEmailLimit(email: string | null | undefined, recentCount: number): OfferGuardReason | null {
  if (!email) return 'email_required'
  if (recentCount >= OFFER_MAX_PER_EMAIL_PER_DAY) return 'email_rate_limited'
  return null
}

/**
 * IP-level breaker for the rolling 24h window. A missing IP never hard-fails
 * — absent telemetry must not lock customers out.
 */
export function checkDailyIpLimit(ip: string | null | undefined, recentCount: number): OfferGuardReason | null {
  if (!ip) return null
  if (recentCount >= OFFER_MAX_PER_IP_PER_DAY) return 'ip_rate_limited'
  return null
}

/** Customer-safe message per guard reason (no internals leaked). */
export function offerGuardMessage(reason: OfferGuardReason): string {
  switch (reason) {
    case 'email_required': return 'Email is required'
    case 'too_many_open_offers': return 'You already have several offers awaiting a response. Please wait for those to be answered first.'
    case 'email_rate_limited': return 'Too many offers submitted recently. Please try again later.'
    case 'ip_rate_limited': return 'Too many requests from this network. Please try again later.'
  }
}
