/**
 * Background sweep that expires accepted offers whose payment window lapsed
 * without payment. Follows the same fixed-setInterval pattern as
 * notificationScheduler (this project ships no cron library); each flip is a
 * guarded updateMany on status, so concurrent instances cannot double-apply.
 *
 * Lazily enforced too — getCustomerOfferForPayment / createOfferOrder expire
 * on read, so a lapsed offer can never be paid even between sweeps.
 */
import { prisma } from '../server.js'
import { logAudit } from '../utils/audit.js'
import logger from '../utils/logger.js'

const log = logger.child({ context: 'offer-expiry' })

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000
const FIRST_RUN_DELAY_MS = 60 * 1000
const BATCH_SIZE = 200

export async function sweepExpiredOffers(): Promise<number> {
  const lapsed = await prisma.offer.findMany({
    where: {
      status: { in: ['accepted', 'awaiting-payment'] },
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
    take: BATCH_SIZE,
  })

  let expired = 0
  for (const offer of lapsed) {
    const updated = await prisma.offer.updateMany({
      where: { id: offer.id, status: { in: ['accepted', 'awaiting-payment'] } },
      data: { status: 'expired' },
    })
    if (updated.count > 0) {
      expired++
      await logAudit({ action: 'offer.expire', entityType: 'offer', entityId: offer.id })
    }
  }
  if (expired > 0) log.info({ expired }, 'Expired lapsed accepted offers')
  return expired
}

let interval: ReturnType<typeof setInterval> | null = null
let firstRun: ReturnType<typeof setTimeout> | null = null

export function startOfferExpiryScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (interval) return

  firstRun = setTimeout(() => {
    void sweepExpiredOffers().catch((err) => log.error({ err }, 'Offer expiry sweep failed'))
  }, FIRST_RUN_DELAY_MS)

  interval = setInterval(() => {
    void sweepExpiredOffers().catch((err) => log.error({ err }, 'Offer expiry sweep failed'))
  }, intervalMs)
}

export function stopOfferExpiryScheduler() {
  if (firstRun) { clearTimeout(firstRun); firstRun = null }
  if (interval) { clearInterval(interval); interval = null }
}
