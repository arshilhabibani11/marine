/**
 * eBay sync scheduler (roadmap C — eventual consistency).
 *
 * Follows the fixed-setInterval pattern of offerExpiryScheduler (no cron lib).
 *
 * Three jobs:
 *   1. syncPendingListings  — pushes CENTRAL stock to every eBay offer whose
 *      listing is marked sync-pending. Central inventory is authoritative:
 *      failures never roll stock back, only mark the mirror unhealthy.
 *   2. reconcileEbayQuantities — detects drift between central stock and the
 *      last synced quantity (e.g. a missed webhook) and re-enqueues.
 *   3. retryPendingEvents — reprocesses deferred webhook events (temporary
 *      failures at delivery time) through the idempotent order processor.
 */
import { prisma } from '../server.js'
import logger from '../utils/logger.js'
import { isEbayConfigured, updateOfferQuantity, isRetryableError } from './ebayClient.js'

const log = logger.child({ context: 'ebay-sync' })

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000
const FIRST_RUN_DELAY_MS = 90 * 1000
const BATCH_SIZE = 50
/** Listings in sync-failed are terminal-ish; reconciliation re-enqueues on drift. */
const RETRYABLE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Job 1: push central stock to eBay for all pending listings. */
export async function syncPendingListings(): Promise<{ synced: number; failed: number; skipped: number }> {
  const result = { synced: 0, failed: 0, skipped: 0 }
  if (!isEbayConfigured()) {
    if (process.env.NODE_ENV !== 'production' || Math.random() < 0.02) {
      log.info('eBay not configured — sync sweep idle')
    }
    return result
  }

  const listings = await prisma.ebayListing.findMany({
    where: { status: 'sync-pending' },
    include: { product: { select: { stockCount: true, status: true, sku: true } } },
    take: BATCH_SIZE,
    orderBy: { updatedAt: 'asc' },
  })

  for (const listing of listings) {
    // Product archived/unpublished → end pushing; the listing row just idles.
    if (listing.product.status !== 'published') {
      await prisma.ebayListing.update({
        where: { id: listing.id },
        data: { status: 'sync-failed', lastError: 'product no longer published — map or end the eBay listing' },
      })
      result.skipped++
      continue
    }
    if (!listing.ebayOfferId) {
      await prisma.ebayListing.update({
        where: { id: listing.id },
        data: { status: 'sync-failed', lastError: 'no ebayOfferId stored — cannot push quantity' },
      })
      result.skipped++
      continue
    }

    const centralQty = listing.product.stockCount
    try {
      await updateOfferQuantity(listing.ebayOfferId, centralQty)
      await prisma.ebayListing.update({
        where: { id: listing.id },
        data: { status: 'synced', lastSyncedQty: centralQty, lastSyncAt: new Date(), lastError: null },
      })
      result.synced++
      log.info({ sku: listing.sku, offerId: listing.ebayOfferId, qty: centralQty }, 'eBay quantity synced')
    } catch (err) {
      const retryable = isRetryableError(err)
      // NEVER roll back central stock because eBay failed (spec).
      await prisma.ebayListing.update({
        where: { id: listing.id },
        data: {
          status: retryable ? 'sync-pending' : 'sync-failed',
          lastError: (err as Error).message.slice(0, 500),
        },
      })
      result.failed++
      log.warn({ err, sku: listing.sku, retryable }, 'eBay quantity sync failed (central stock unchanged)')
    }
  }
  return result
}

/** Job 2: detect drift between central stock and the last pushed quantity. */
export async function reconcileEbayQuantities(): Promise<number> {
  if (!isEbayConfigured()) return 0

  const active = await prisma.ebayListing.findMany({
    where: { status: { in: ['synced', 'published', 'sync-failed'] } },
    include: { product: { select: { stockCount: true, status: true } } },
    take: 500,
  })

  let drifted = 0
  for (const listing of active) {
    if (listing.product.status !== 'published') continue
    const central = listing.product.stockCount
    if (listing.lastSyncedQty !== central) {
      await prisma.ebayListing.update({
        where: { id: listing.id },
        data: { status: 'sync-pending', lastError: `reconciliation: central=${central} lastSynced=${listing.lastSyncedQty ?? 'never'}` },
      })
      drifted++
    }
  }
  if (drifted > 0) log.info({ drifted }, 'Reconciliation found eBay quantity drift — re-enqueued')
  return drifted
}

/** Job 3: reprocess webhook events that deferred on temporary failures. */
export async function retryDeferredEvents(): Promise<number> {
  if (!isEbayConfigured()) return 0
  const { retryPendingEvents } = await import('./ebayOrderService.js')
  return retryPendingEvents()
}

let interval: ReturnType<typeof setInterval> | null = null
let firstRun: ReturnType<typeof setTimeout> | null = null
let running = false

async function tick() {
  if (running) return // never overlap sweeps
  running = true
  try {
    await syncPendingListings()
    await reconcileEbayQuantities()
    await retryDeferredEvents()
  } catch (err) {
    log.error({ err }, 'eBay sync tick failed')
  } finally {
    running = false
  }
}

export function startEbaySyncScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (interval) return
  firstRun = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS)
  interval = setInterval(() => void tick(), intervalMs)
  log.info({ intervalMs }, 'eBay sync scheduler started')
}

export function stopEbaySyncScheduler() {
  if (firstRun) { clearTimeout(firstRun); firstRun = null }
  if (interval) { clearInterval(interval); interval = null }
}

/** Manual "sync now" for the admin view — runs one pass immediately. */
export async function syncNow() {
  const listings = await syncPendingListings()
  const drift = await reconcileEbayQuantities()
  return { ...listings, driftFound: drift }
}
