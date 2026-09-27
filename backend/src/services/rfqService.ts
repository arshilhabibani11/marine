import { prisma } from '../server.js'
import { generateRfqNumber, generateOrderNumber, generateOfferNumber, paginationParams, paginationResponse } from '../utils/helpers.js'
import { rfqInclude } from '../utils/prisma-helpers.js'
import { logAudit } from '../utils/audit.js'
import { sendRfqReceived, sendRfqResponse } from './email.js'
import { shouldNotify } from './settingsService.js'
import logger from '../utils/logger.js'
import type { AuthUser } from '../middleware/auth.js'

// ─── Types ────────────────────────────────────────────────────

export interface RfqFilters {
  status?: string
  urgency?: string
  assignedTo?: string
  search?: string
  page?: number
  limit?: number
}

// ─── Storefront ───────────────────────────────────────────────

export async function createRfq(data: {
  fullName: string; company?: string; email: string; phone?: string
  country?: string; role?: string; productDescription: string
  partNumber?: string; brand?: string; quantity?: number
  deliveryLocation?: string; urgency?: string; notes?: string
  source?: string; consent: boolean
}) {
  const { notes, ...dbFields } = data
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: await generateRfqNumber(),
      ...dbFields,
      internalNotes: notes || null,
      status: 'new',
      responseDeadline: data.urgency === 'emergency'
        ? new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        : data.urgency === 'urgent'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          : null,
    },
  })

  await logAudit({
    action: 'rfq.create',
    entityType: 'rfq',
    entityId: rfq.id,
    entityName: rfq.rfqNumber,
    newValue: rfq,
  })

  // Notify admin team (non-blocking), honouring the admin notification prefs
  // saved in Settings → Notifications (store.notifications).
  const emergency = data.urgency === 'emergency'
  let notify = true
  try {
    const [received, urgent] = await Promise.all([shouldNotify('rfqReceived'), shouldNotify('rfqUrgent')])
    notify = received && (!emergency || urgent)
  } catch (err) {
    logger.warn({ err }, 'RFQ notification prefs lookup failed; notifying anyway')
  }
  if (notify) {
    sendRfqReceived({
      rfqNumber: rfq.rfqNumber,
      customerName: data.fullName,
      productDescription: data.productDescription,
      urgency: data.urgency || 'standard',
    }).catch(err => logger.error({ err }, 'RFQ email failed'))
  }

  return rfq
}

// ─── Queries ──────────────────────────────────────────────────

export async function listRfqs(params: RfqFilters) {
  const { page, limit, skip } = paginationParams(params.page, params.limit)

  const where: any = {}
  if (params.status) where.status = params.status
  if (params.urgency) where.urgency = params.urgency
  if (params.assignedTo) where.assignedTo = params.assignedTo
  if (params.search) {
    where.OR = [
      { fullName: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
      { company: { contains: params.search, mode: 'insensitive' } },
      { rfqNumber: { contains: params.search, mode: 'insensitive' } },
      { productDescription: { contains: params.search, mode: 'insensitive' } },
      { partNumber: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [rfqs, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      include: rfqInclude,
      orderBy: [{ urgency: 'asc' }, { createdAt: 'desc' }],
      skip, take: limit,
    }),
    prisma.rfq.count({ where }),
  ])

  return { rfqs, pagination: paginationResponse(total, page, limit) }
}

export async function listAssignableAdmins() {
  const users = await prisma.adminUser.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return { users }
}

export async function getRfq(id: string) {
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: rfqInclude,
  })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })
  return rfq
}

// ─── Mutations ────────────────────────────────────────────────

export async function updateRfqStatus(id: string, status: string, note: string | undefined, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  const updated = await prisma.rfq.update({
    where: { id },
    data: { status },
  })

  if (note) {
    await prisma.rfqNote.create({
      data: { rfqId: rfq.id, authorId: actor.id, note, isInternal: true },
    })
  }

  await logAudit({
    actor, action: 'rfq.status.update',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    previousValue: { status: rfq.status }, newValue: { status },
    ipAddress,
  })

  return updated
}

export async function assignRfq(id: string, assignedTo: string, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  const assignee = await prisma.adminUser.findUnique({ where: { id: assignedTo } })
  if (!assignee) throw Object.assign(new Error('Assignee not found'), { status: 400 })

  const updated = await prisma.rfq.update({
    where: { id },
    data: { assignedTo },
  })

  await logAudit({
    actor, action: 'rfq.assign',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    newValue: { assignedTo: assignee.name },
    ipAddress,
  })

  return updated
}

export async function addRfqNote(id: string, noteText: string, isInternal: boolean, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  const note = await prisma.rfqNote.create({
    data: { rfqId: rfq.id, authorId: actor.id, note: noteText, isInternal: isInternal ?? true },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  await logAudit({
    actor, action: 'rfq.note.add',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    ipAddress,
  })

  return note
}

export async function respondToRfq(id: string, message: string, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  // Update status to quote-sent if new/reviewing
  if (rfq.status === 'new' || rfq.status === 'reviewing') {
    await prisma.rfq.update({ where: { id: rfq.id }, data: { status: 'quote-sent' } })
  }

  // Add response as note
  await prisma.rfqNote.create({
    data: { rfqId: rfq.id, authorId: actor.id, note: `Response sent: ${message}`, isInternal: false },
  })

  // Send email (non-blocking)
  sendRfqResponse({
    to: rfq.email, customerName: rfq.fullName, rfqNumber: rfq.rfqNumber, message,
  }).catch(err => logger.error({ err }, 'RFQ response email failed'))

  await logAudit({
    actor, action: 'rfq.respond',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    ipAddress,
  })
}

export async function convertRfqToOffer(id: string, offeredPrice: number, message: string | undefined, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  const offer = await prisma.offer.create({
    data: {
      offerNumber: await generateOfferNumber(),
      customerEmail: rfq.email,
      offeredPrice,
      quantity: rfq.quantity,
      message: message || `Converted from RFQ ${rfq.rfqNumber}`,
      status: 'pending',
      rfqId: rfq.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  await prisma.rfq.update({ where: { id: rfq.id }, data: { status: 'quote-sent' } })

  await logAudit({
    actor, action: 'rfq.convert-to-offer',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    newValue: { offerId: offer.id, offerNumber: offer.offerNumber },
    ipAddress,
  })

  return offer
}

export async function convertRfqToOrder(id: string, total: number, unitPrice: number, actor: AuthUser, ipAddress = '') {
  const rfq = await prisma.rfq.findUnique({ where: { id } })
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 })

  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(),
      status: 'pending',
      paymentMethod: 'bank-transfer',
      paymentStatus: 'pending',
      subtotal: total || 0,
      shippingCost: 25,
      tax: 0,
      total: (total || 0) + 25,
      currency: 'USD',
      shippingFullName: rfq.fullName,
      shippingCity: rfq.deliveryLocation || '',
      shippingCountry: rfq.country || '',
      customerNotes: `Converted from RFQ ${rfq.rfqNumber}`,
    },
  })

  try {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productName: rfq.productDescription.slice(0, 500),
        productSku: rfq.partNumber || '',
        quantity: rfq.quantity,
        unitPrice: unitPrice || 0,
        totalPrice: (unitPrice || 0) * rfq.quantity,
      },
    })
    await prisma.orderTimeline.create({
      data: { orderId: order.id, status: 'pending', note: `Converted from RFQ ${rfq.rfqNumber}` },
    })
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    throw error
  }

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true },
  })

  await prisma.rfq.update({ where: { id: rfq.id }, data: { status: 'won' } })

  await logAudit({
    actor, action: 'rfq.convert-to-order',
    entityType: 'rfq', entityId: rfq.id, entityName: rfq.rfqNumber,
    newValue: { orderId: order.id, orderNumber: order.orderNumber },
    ipAddress,
  })

  return fullOrder
}
