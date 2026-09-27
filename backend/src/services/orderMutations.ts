import { prisma } from '../server.js'
import { generateOrderNumber } from '../utils/helpers.js'
import { orderInclude } from '../utils/prisma-helpers.js'
import { logAudit } from '../utils/audit.js'
import { sendOrderShipped, sendOrderCancelled, sendOrderConfirmation } from './emailSenders.js'
import { escapeHtml } from '../utils/html-escape.js'
import logger from '../utils/logger.js'
import { processPaypalRefund } from '../utils/paypal.js'
import { calcShippingCost, parseShippingZones } from '../utils/shipping.js'
import { getStoreTimezone } from './settingsService.js'
import type { AuthUser } from '../middleware/auth.js'

const STATUS_FLOW = ['pending', 'confirmed', 'paid', 'processing', 'packed', 'shipped', 'delivered']

export interface CreateOrderInput {
  items: { productId: string; quantity: number }[]
  shipping: {
    fullName: string; addressLine1: string; addressLine2?: string
    city: string; state?: string; postalCode?: string; country: string
  }
  paymentMethod: string
  customerNotes?: string
  idempotencyKey?: string
  customerId?: string | null
}

// ─── Create Order ──────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput) {
  const { items, shipping, paymentMethod, customerNotes, idempotencyKey, customerId } = input

  if (idempotencyKey) {
    const existingOrder = await prisma.order.findFirst({
      where: {
        customerId,
        customerNotes: { contains: `[idem:${idempotencyKey}]` },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      include: { items: true },
    })
    if (existingOrder) return existingOrder
  }

  let subtotal = 0
  const orderItems: Array<{
    productId: string; productName: string; productSku: string
    quantity: number; unitPrice: number; totalPrice: number
  }> = []
  const skippedItems: Array<{ productId: string; quantity: number }> = []

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) {
      // P1-2: a line whose product no longer exists (e.g. the products table is
      // empty) must not hard-fail the entire checkout. Skip the unavailable
      // line so the remaining, still-available items can be ordered; skipped
      // lines are recorded on the timeline for admin visibility. Server-side
      // price authority is unchanged — every priced line still comes from the
      // product table, never from the client.
      logger.warn({ productId: item.productId }, 'Order line skipped — product not found in catalog')
      skippedItems.push({ productId: item.productId, quantity: item.quantity })
      continue
    }
    if (product.availability === 'out-of-stock' || product.stockCount < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), { status: 400 })
    }
    const price = Number(product.salePrice && Number(product.salePrice) < Number(product.regularPrice) ? product.salePrice : product.regularPrice)
    orderItems.push({
      productId: product.id, productName: product.name, productSku: product.sku,
      quantity: item.quantity, unitPrice: price, totalPrice: price * item.quantity,
    })
    subtotal += price * item.quantity
  }

  // If every line was unavailable (e.g. entirely empty catalog), fail with a
  // clear, actionable error instead of a confusing 400 crash mid-checkout.
  if (orderItems.length === 0) {
    throw Object.assign(
      new Error('The items in your cart are no longer available. Please review your cart and try again.'),
      { status: 409 }
    )
  }

  const [shippingCostSetting, taxRateSetting, freeShippingThresholdSetting, shippingZonesSetting] = await Promise.all([
    prisma.storeSetting.findUnique({ where: { key: 'checkout.shippingCost' } }),
    prisma.storeSetting.findUnique({ where: { key: 'checkout.taxRate' } }),
    prisma.storeSetting.findUnique({ where: { key: 'checkout.freeShippingThreshold' } }),
    prisma.storeSetting.findUnique({ where: { key: 'store.shippingZones' } }),
  ])

  // Shipping is priced by the customer's country from the admin-configured
  // shipping zones; when no zone matches (or none are configured) it falls back
  // to the flat checkout.shippingCost + free-shipping threshold. The server
  // always calculates this — the client can never dictate shipping.
  const baseShippingCost = Number(shippingCostSetting?.value) || Number(process.env.DEFAULT_SHIPPING_COST) || 25
  const freeShippingThreshold = Number(freeShippingThresholdSetting?.value) || 100
  const shippingCost = calcShippingCost({
    subtotal,
    country: shipping.country,
    zones: parseShippingZones(shippingZonesSetting?.value),
    baseShippingCost,
    freeShippingThreshold,
  })
  const taxRate = Number(taxRateSetting?.value) || Number(process.env.DEFAULT_TAX_RATE) || 0.08
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = subtotal + shippingCost + tax

  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(), customerId,
      status: 'pending', paymentMethod, paymentStatus: 'pending',
      subtotal, shippingCost, tax, total, currency: 'USD',
      shippingFullName: shipping.fullName,
      shippingAddressLine1: shipping.addressLine1,
      shippingAddressLine2: shipping.addressLine2 || null,
      shippingCity: shipping.city,
      shippingState: shipping.state || null,
      shippingPostalCode: shipping.postalCode || null,
      shippingCountry: shipping.country,
      customerNotes: idempotencyKey ? `[idem:${idempotencyKey}] ${customerNotes || ''}` : (customerNotes || null),
    },
  })

  try {
    for (const i of orderItems) {
      await prisma.orderItem.create({ data: { orderId: order.id, ...i } })
    }
    await prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        status: 'pending',
        note: skippedItems.length > 0
          ? `Order placed. Skipped unavailable item(s): ${skippedItems.map(i => `${i.productId} (x${i.quantity})`).join(', ')}`
          : 'Order placed',
      },
    })
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    throw error
  }

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, timeline: true },
  })

  await logAudit({
    action: 'order.create', entityType: 'order',
    entityId: order.id, entityName: order.orderNumber,
    newValue: order,
  })

  return fullOrder
}

// ─── Request Cancellation ──────────────────────────────────────

export async function requestOrderCancellation(id: string, customerId: string, reason?: string) {
  const order = await prisma.order.findFirst({ where: { id, customerId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.status === 'cancelled') throw Object.assign(new Error('Order already cancelled'), { status: 400 })

  const updated = await prisma.order.update({
    where: { id },
    data: { cancelRequested: true, cancelReason: reason || 'Customer requested', cancelRequestedAt: new Date() },
  })

  await prisma.orderTimeline.create({
    data: { orderId: id, status: order.status, note: 'Cancellation requested: ' + (reason || 'No reason provided') },
  })

  const cancelCustomer = await prisma.customer.findUnique({ where: { id: customerId }, select: { email: true, name: true } })
  if (cancelCustomer) {
    sendOrderCancelled({
      to: cancelCustomer.email, customerName: cancelCustomer.name,
      orderNumber: updated.orderNumber, reason: reason || 'Customer cancellation request',
    }).catch(err => logger.error({ err }, 'Order cancel email failed'))
  }

  return updated
}

// ─── Admin: Update Status ──────────────────────────────────────

export async function updateOrderStatus(id: string, status: string, note: string | undefined, actor: AuthUser, ipAddress = '') {
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

  const currentIdx = STATUS_FLOW.indexOf(order.status)
  const newIdx = STATUS_FLOW.indexOf(status)

  if (status !== 'cancelled' && (currentIdx === -1 || newIdx <= currentIdx)) {
    throw Object.assign(new Error('Can only advance order status forward'), { status: 400 })
  }

  const updated = await prisma.order.update({ where: { id }, data: { status } })

  await prisma.orderTimeline.create({
    data: { orderId: id, status, note, createdBy: actor.id },
  })

  if (status === 'paid' && order.paymentStatus !== 'paid') {
    const items = await prisma.orderItem.findMany({ where: { orderId: id } })
    let stockFailed = false
    for (const item of items) {
      if (item.productId) {
        const affected = await prisma.$executeRawUnsafe(
          'UPDATE products SET stock_count = stock_count - $1 WHERE id = $2::uuid AND stock_count >= $1',
          item.quantity, item.productId
        )
        if (affected === 0) {
          stockFailed = true
          logger.error({ productId: item.productId, quantity: item.quantity, orderId: id }, 'Stock decrement failed during admin order confirmation')
        }
      }
    }
    // Never leave the order marked paid when the required stock decrement failed.
    // Revert the status and surface the failure instead of silently succeeding.
    if (stockFailed) {
      await prisma.order.update({ where: { id }, data: { status: order.status } })
      await prisma.orderTimeline.create({
        data: { orderId: id, status: order.status, note: 'Stock decrement failed — order reverted. Manual review required.' },
      })
      throw Object.assign(new Error('Order could not be confirmed: stock decrement failed. Manual review required.'), { status: 409 })
    }
  }

  if (status === 'cancelled' && order.paymentStatus === 'paid') {
    await restoreStockAndRefund(id, order)
  }

  await logAudit({
    actor, action: 'order.status.update', entityType: 'order',
    entityId: order.id, entityName: order.orderNumber,
    newValue: { status }, ipAddress,
  })

  if (status === 'paid' && order.paymentMethod !== 'card') {
    await sendOrderPaidEmail(id, order)
  }
  if (status === 'cancelled') {
    await sendOrderCancelledEmail(order)
  }

  return updated
}

// ─── Admin: Update Tracking ────────────────────────────────────

export async function updateTracking(id: string, trackingNumber: string, courier: string) {
  const order = await prisma.order.update({
    where: { id }, data: { trackingNumber, courier },
  })

  if (order.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: order.customerId }, select: { email: true, name: true },
    })
    if (customer) {
      sendOrderShipped({
        to: customer.email, customerName: customer.name,
        orderNumber: order.orderNumber, trackingNumber, courier,
      }).catch(err => logger.error({ err }, 'Ship email failed'))
    }
  }

  return order
}

// ─── Admin: Cancel Order ───────────────────────────────────────

export async function cancelOrder(id: string, reason: string | undefined, actor: AuthUser, ipAddress = '') {
  const existingOrder = await prisma.order.findUnique({ where: { id } })
  if (!existingOrder) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (existingOrder.status === 'cancelled') throw Object.assign(new Error('Order already cancelled'), { status: 400 })

  const order = await prisma.order.update({
    where: { id },
    data: { status: 'cancelled', cancelRequested: false, cancelReason: reason || 'Cancelled by admin' },
  })

  await prisma.orderTimeline.create({
    data: { orderId: id, status: 'cancelled', note: reason, createdBy: actor.id },
  })

  if (order.paymentStatus === 'paid') {
    await restoreStockAndRefund(id, order)
  }

  await logAudit({
    actor, action: 'order.cancel', entityType: 'order',
    entityId: order.id, entityName: order.orderNumber, ipAddress,
  })

  await sendOrderCancelledEmail(order)
  return order
}

// ─── Generate Invoice HTML ─────────────────────────────────────

export async function generateInvoiceHtml(id: string) {
  const order = await prisma.order.findUnique({
    where: { id }, include: orderInclude,
  })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

  const items = (order.items || []).map((item: any) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.product?.name || item.productName || 'Product')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${escapeHtml(item.product?.sku || item.sku || '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(item.unitPrice || item.price || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">$${((item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('')

  // Format the invoice date in the admin-configured store timezone (site.timezone).
  const timezone = await getStoreTimezone().catch(() => undefined)
  const invoiceDate = order.createdAt.toLocaleDateString('en-US', timezone ? { timeZone: timezone } : undefined)

  const customer = (order as Record<string, unknown>).customer as Record<string, string> || {}
  const shipping = {
    fullName: order.shippingFullName || '',
    addressLine1: order.shippingAddressLine1 || '',
    city: order.shippingCity || '',
    country: order.shippingCountry || '',
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(order.orderNumber)}</title></head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:30px">
      <div><h1 style="margin:0;color:#0EA5E9">ALKA TRADERS</h1><p style="color:#666;font-size:13px">Marine & Industrial Equipment</p></div>
      <div style="text-align:right"><h2 style="margin:0">INVOICE</h2><p style="font-family:monospace;font-size:14px;color:#666">#${order.orderNumber}</p><p style="font-size:13px;color:#666">Date: ${invoiceDate}</p></div>
    </div>
    <div style="display:flex;gap:40px;margin-bottom:30px">
      <div style="flex:1"><h3 style="font-size:12px;text-transform:uppercase;color:#999;margin-bottom:8px">Bill To</h3><p style="font-size:13px"><strong>${escapeHtml(customer.name || shipping.fullName || 'N/A')}</strong></p><p style="font-size:13px;color:#666">${escapeHtml(customer.email || '')}</p><p style="font-size:13px;color:#666">${escapeHtml(shipping.addressLine1 || '')}${shipping.city ? ', ' + escapeHtml(shipping.city) : ''}${shipping.country ? ', ' + escapeHtml(shipping.country) : ''}</p></div>
      <div style="flex:1"><h3 style="font-size:12px;text-transform:uppercase;color:#999;margin-bottom:8px">Payment</h3><p style="font-size:13px">Method: ${escapeHtml(order.paymentMethod || 'N/A')}</p><p style="font-size:13px">Status: ${escapeHtml(order.paymentStatus || 'pending')}</p>${order.trackingNumber ? `<p style="font-size:13px">Tracking: ${escapeHtml(order.trackingNumber)} (${escapeHtml(order.courier || '')})</p>` : ''}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">${items}</table>
    <div style="margin-top:20px;text-align:right">
      <p style="font-size:13px">Subtotal: $${(order.subtotal || 0).toFixed(2)}</p>
      <p style="font-size:13px">Shipping: $${(order.shippingCost || 0).toFixed(2)}</p>
      <p style="font-size:13px">Tax: $${(order.tax || 0).toFixed(2)}</p>
      <p style="font-size:18px;font-weight:bold;border-top:2px solid #333;padding-top:8px;margin-top:8px">Grand Total: $${(order.total || 0).toFixed(2)}</p>
    </div>
  </body></html>`
}

// ─── Private Helpers ──────────────────────────────────────────

async function restoreStockAndRefund(id: string, order: any) {
  const items = await prisma.orderItem.findMany({ where: { orderId: id } })
  for (const item of items) {
    if (item.productId) {
      await prisma.$executeRawUnsafe(
        'UPDATE products SET stock_count = stock_count + $1 WHERE id = $2::uuid',
        item.quantity, item.productId
      )
    }
  }

  let refunded = false
  if (order.paymentIntentId && order.paymentMethod === 'paypal') {
    const refundResult = await processPaypalRefund(
      order.paymentIntentId, Number(order.total), order.currency || 'USD'
    )
    if (refundResult.success) {
      refunded = true
      logger.info({ orderId: order.id, orderNumber: order.orderNumber }, 'PayPal refund processed')
    } else {
      // Never mark the order as refunded when the actual refund failed — the
      // customer would show as refunded without the money ever being returned.
      logger.error({ orderId: order.id, error: refundResult.error }, 'PayPal refund failed — order NOT marked as refunded')
      await prisma.orderTimeline.create({
        data: { orderId: id, status: 'cancelled', note: 'PayPal refund FAILED — customer has not been refunded. Manual refund required.' },
      })
    }
  } else {
    // No automated PayPal refund needed (bank transfer / card / no intent id) —
    // preserve the existing behavior of marking the order refunded.
    refunded = true
  }

  if (refunded) {
    await prisma.order.update({ where: { id }, data: { paymentStatus: 'refunded' } })
  }
}

async function sendOrderPaidEmail(id: string, order: any) {
  if (!order.customerId) return
  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId }, select: { email: true, name: true },
  })
  if (!customer) return

  const orderItems = await prisma.orderItem.findMany({ where: { orderId: id } })
  const shippingAddr = [order.shippingAddressLine1, order.shippingAddressLine2, order.shippingCity, order.shippingState, order.shippingPostalCode, order.shippingCountry].filter(Boolean).join(', ')

  sendOrderConfirmation({
    to: customer.email, customerName: customer.name, orderNumber: order.orderNumber,
    items: orderItems.map(i => ({ name: i.productName, quantity: i.quantity, price: Number(i.unitPrice) })),
    subtotal: Number(order.subtotal), shippingCost: Number(order.shippingCost),
    tax: Number(order.tax), total: Number(order.total),
    shippingAddress: shippingAddr,
  }).catch(err => logger.error({ err }, 'Order confirmation email failed'))
}

async function sendOrderCancelledEmail(order: any) {
  if (!order.customerId) return
  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId }, select: { email: true, name: true },
  })
  if (!customer) return

  sendOrderCancelled({
    to: customer.email, customerName: customer.name,
    orderNumber: order.orderNumber, reason: order.cancelReason || 'Cancelled by admin',
  }).catch(err => logger.error({ err }, 'Cancel email failed'))
}
