import { prisma } from '../server.js'
import { paginationParams, paginationResponse, generateOrderNumber } from '../utils/helpers.js'
import { logAudit } from '../utils/audit.js'
import { sendOfferDecision } from './emailSenders.js'
import logger from '../utils/logger.js'
import type { AuthUser } from '../middleware/auth.js'
import { canDecide, acceptedAmountOf, OFFER_PAYMENT_WINDOW_MS, type AdminOfferAction } from './offerRules.js'

/** Guarded admin decision wrapper: re-checks the current status atomically so
 * double-clicks and racing admins can never double-apply a decision. */
async function guardedDecision(
  id: string,
  action: AdminOfferAction,
  actor: AuthUser,
  data: { status: string; counterPrice?: number; acceptedPrice?: number; expiresAt?: Date; acceptedAt?: Date },
) {
  const existing = await prisma.offer.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('Offer not found'), { status: 404 })
  if (!canDecide(existing.status, action)) {
    throw Object.assign(new Error(`Offer cannot be ${action}ed from status "${existing.status}"`), { status: 409 })
  }

  const updated = await prisma.offer.updateMany({
    where: { id, status: existing.status },
    data: { respondedAt: new Date(), ...data },
  })
  if (updated.count === 0) {
    throw Object.assign(new Error('Offer was just modified — reload and try again'), { status: 409 })
  }

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      order: { select: { id: true, orderNumber: true, paymentStatus: true } },
    },
  })
  return offer!
}

// ─── Queries ──────────────────────────────────────────────────

export async function listOffers(params: { status?: string; productId?: string; search?: string; page?: number; limit?: number }) {
  const { page, limit, skip } = paginationParams(params.page, params.limit)

  const where: any = {}
  if (params.status) where.status = params.status
  if (params.productId) where.productId = params.productId
  if (params.search) {
    const q = { contains: params.search, mode: 'insensitive' } as const
    where.OR = [
      { offerNumber: q },
      { customerEmail: q },
      { message: q },
      { adminNotes: q },
      { customer: { name: q } },
      { customer: { company: q } },
      { product: { name: q } },
      { product: { sku: q } },
      { rfq: { rfqNumber: q } },
    ]
  }

  const [offers, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, regularPrice: true } },
        rfq: { select: { id: true, rfqNumber: true } },
        customer: { select: { id: true, name: true, company: true, country: true } },
        order: { select: { id: true, orderNumber: true, paymentStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.offer.count({ where }),
  ])

  return { offers, pagination: paginationResponse(total, page, limit) }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export async function exportOffersCsv() {
  const offers = await prisma.offer.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      rfq: { select: { rfqNumber: true } },
      customer: { select: { name: true, company: true, country: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'Offer Number', 'RFQ', 'Customer', 'Email', 'Company', 'Country', 'Product', 'SKU',
    'Quantity', 'Offered Price', 'Counter Price', 'Status', 'Created', 'Expires',
  ]
  const rows = offers.map((o) => [
    o.offerNumber,
    o.rfq?.rfqNumber || '',
    o.customer?.name || '',
    o.customerEmail,
    o.customer?.company || '',
    o.customer?.country || '',
    o.product?.name || '',
    o.product?.sku || '',
    o.quantity,
    Number(o.offeredPrice),
    o.counterPrice != null ? Number(o.counterPrice) : '',
    o.status,
    o.createdAt.toISOString().slice(0, 10),
    o.expiresAt ? o.expiresAt.toISOString().slice(0, 10) : '',
  ])

  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}

export async function getOffer(id: string) {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, sku: true, regularPrice: true, salePrice: true, stockCount: true } },
      rfq: { select: { id: true, rfqNumber: true } },
      customer: { select: { id: true, name: true, company: true, country: true } },
      order: { select: { id: true, orderNumber: true, paymentStatus: true, status: true, total: true } },
    },
  })
  if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 })
  return { offer }
}

// ─── Mutations ────────────────────────────────────────────────

export async function acceptOffer(id: string, actor: AuthUser) {
  // Snapshot the price the customer will actually pay BEFORE the guarded flip:
  // a pending counter supersedes the customer's original amount.
  const current = await prisma.offer.findUnique({ where: { id } })
  if (!current) throw Object.assign(new Error('Offer not found'), { status: 404 })
  const acceptedPrice = acceptedAmountOf(current)

  const offer = await guardedDecision(id, 'accept', actor, {
    status: 'accepted',
    acceptedPrice,
    // Payment window starts at acceptance; lazily enforced + swept (offerService).
    acceptedAt: new Date(),
    expiresAt: new Date(Date.now() + OFFER_PAYMENT_WINDOW_MS),
  })

  await logAudit({
    actor, action: 'offer.accept', entityType: 'offer', entityId: offer.id, entityName: offer.offerNumber,
    newValue: { status: 'accepted', acceptedPrice },
  })
  sendOfferDecision({ to: offer.customerEmail, offerNumber: offer.offerNumber, productName: offer.product?.name || 'Unknown', decision: 'accepted' }).catch(err => logger.error({ err }, 'Offer email failed'))
  return { offer }
}

export async function rejectOffer(id: string, actor: AuthUser) {
  const offer = await guardedDecision(id, 'reject', actor, { status: 'rejected' })
  await logAudit({ actor, action: 'offer.reject', entityType: 'offer', entityId: offer.id, entityName: offer.offerNumber })
  sendOfferDecision({ to: offer.customerEmail, offerNumber: offer.offerNumber, productName: offer.product?.name || 'Unknown', decision: 'rejected' }).catch(err => logger.error({ err }, 'Offer email failed'))
  return { offer }
}

export async function counterOffer(id: string, counterPrice: number, actor: AuthUser) {
  const offer = await guardedDecision(id, 'counter', actor, { status: 'countered', counterPrice })
  await logAudit({
    actor, action: 'offer.counter', entityType: 'offer', entityId: offer.id, entityName: offer.offerNumber,
    newValue: { counterPrice },
  })
  sendOfferDecision({ to: offer.customerEmail, offerNumber: offer.offerNumber, productName: offer.product?.name || 'Unknown', decision: 'countered', counterPrice }).catch(err => logger.error({ err }, 'Offer email failed'))
  return { offer }
}

export async function convertOfferToOrder(id: string, actor: AuthUser) {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, sku: true, regularPrice: true, salePrice: true } } },
  })
  if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 })
  if (offer.orderId) throw Object.assign(new Error('This offer already has an order'), { status: 400 })
  if (offer.status !== 'accepted') throw Object.assign(new Error('Only accepted offers can be converted to orders'), { status: 400 })

  const price = Number(offer.acceptedPrice ?? offer.counterPrice ?? offer.offeredPrice)

  // Historical pricing snapshot + offer link so both conversion paths
  // (bank-transfer here, PayPal via offerService) produce identical order data.
  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(),
      status: 'pending',
      paymentMethod: 'bank-transfer',
      paymentStatus: 'pending',
      subtotal: price * offer.quantity,
      shippingCost: 25,
      tax: 0,
      total: price * offer.quantity + 25,
      currency: 'USD',
      originalListedPrice: offer.product ? Number(offer.product.regularPrice) : null,
      negotiatedPrice: price,
      customerNotes: `Converted from offer ${offer.offerNumber}`,
      customerId: offer.customerId || undefined,
      offerId: offer.id,
    },
  })

  try {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: offer.productId || undefined,
        productName: offer.product?.name || 'Unknown Product',
        productSku: offer.product?.sku || '',
        quantity: offer.quantity,
        unitPrice: price,
        totalPrice: price * offer.quantity,
      },
    })
    await prisma.orderTimeline.create({
      data: { orderId: order.id, status: 'pending', note: `Converted from offer ${offer.offerNumber}` },
    })
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    throw error
  }

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true },
  })

  // Guarded transition: a racing PayPal payment or second conversion cannot
  // claim the same offer after the order exists.
  const claimed = await prisma.offer.updateMany({
    where: { id: offer.id, status: offer.status, orderId: null },
    data: { status: 'converted-to-order', acceptedPrice: price, orderId: order.id, ...(offer.status === 'accepted' ? {} : { acceptedAt: new Date() }) },
  })
  if (claimed.count === 0) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    throw Object.assign(new Error('Offer was just converted or paid — reload'), { status: 409 })
  }

  await logAudit({
    actor, action: 'offer.convert-to-order', entityType: 'offer', entityId: offer.id, entityName: offer.offerNumber,
    newValue: { orderId: order.id, orderNumber: order.orderNumber },
  })

  return { order: fullOrder }
}
