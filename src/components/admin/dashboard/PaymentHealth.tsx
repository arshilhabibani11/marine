import { useMemo } from 'react'
import { CreditCard, CheckCircle, Clock, XCircle, DollarSign } from 'lucide-react'

interface Props {
  orders: any[]
}

// order.paymentMethod is stored as 'paypal' | 'bank-transfer' (see
// orderMutations.createOrder + the offers/RFQ conversions). Keys must match
// exactly, otherwise the row never renders.
const METHOD_META: Record<string, { label: string; icon: typeof CreditCard; color: string; bg: string }> = {
  paypal: { label: 'PayPal', icon: DollarSign, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
  'bank-transfer': { label: 'Bank Transfer', icon: CreditCard, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  card: { label: 'Card Payment', icon: CreditCard, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  cod: { label: 'Cash on Delivery', icon: DollarSign, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-soft)]' },
}

function methodLabel(key: string): string {
  return METHOD_META[key]?.label || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PaymentHealth({ orders }: Props) {
  const data = useMemo(() => {
    // paymentStatus is the authoritative payment field: 'pending' | 'paid' | 'refunded'.
    // (order.status is fulfillment and never equals 'refunded'.)
    const isFailed = (o: any) => o.paymentStatus === 'refunded' || o.status === 'cancelled'
    const isPaid = (o: any) => o.paymentStatus === 'paid'

    const byMethod: Record<string, { total: number; paid: number; pending: number; failed: number; revenue: number }> = {}

    for (const order of orders) {
      const method = order.paymentMethod || 'unknown'
      if (!byMethod[method]) {
        byMethod[method] = { total: 0, paid: 0, pending: 0, failed: 0, revenue: 0 }
      }
      byMethod[method].total++

      if (isPaid(order)) {
        byMethod[method].paid++
        byMethod[method].revenue += order.total || 0
      } else if (isFailed(order)) {
        byMethod[method].failed++
      } else {
        byMethod[method].pending++
      }
    }

    const totalOrders = orders.length
    const paidOrders = orders.filter(isPaid).length
    const pendingOrders = orders.filter((o) => !isPaid(o) && !isFailed(o)).length
    const failedOrders = orders.filter(isFailed).length
    const successRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0

    return { byMethod, totalOrders, paidOrders, pendingOrders, failedOrders, successRate }
  }, [orders])

  const methodKeys = Object.keys(data.byMethod).filter((k) => (data.byMethod[k]?.total || 0) > 0)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-[var(--accent-blue)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
            Payment Health
          </h2>
        </div>
        <span className={`text-[0.625rem] font-bold ${
          data.successRate >= 90 ? 'text-[var(--success)]' :
          data.successRate >= 70 ? 'text-[var(--accent-gold)]' :
          'text-[var(--danger)]'
        }`}>
          {data.successRate}% success rate
        </span>
      </div>

      {/* Success rate bar */}
      <div className="h-3 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-[var(--success)] transition-all duration-500"
          style={{ width: `${data.successRate}%` }}
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center rounded-xl bg-[var(--surface-soft)] p-2">
          <CheckCircle size={14} className="mx-auto text-[var(--success)] mb-1" />
          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{data.paidOrders}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Paid</p>
        </div>
        <div className="text-center rounded-xl bg-[var(--surface-soft)] p-2">
          <Clock size={14} className="mx-auto text-[var(--accent-gold)] mb-1" />
          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{data.pendingOrders}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Pending</p>
        </div>
        <div className="text-center rounded-xl bg-[var(--surface-soft)] p-2">
          <XCircle size={14} className="mx-auto text-[var(--danger)] mb-1" />
          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{data.failedOrders}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Failed/Refunded</p>
        </div>
      </div>

      {/* By payment method */}
      <div className="space-y-2">
        {methodKeys.map((key) => {
          const method = data.byMethod[key]
          const meta = METHOD_META[key]
          const Icon = meta?.icon || CreditCard
          const successRate = method.total > 0 ? Math.round((method.paid / method.total) * 100) : 0

          return (
            <div key={key} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta?.bg || 'bg-[var(--surface-soft)]'} ${meta?.color || 'text-[var(--text-muted)]'}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)]">{methodLabel(key)}</p>
                <p className="text-[0.625rem] text-[var(--text-muted)]">
                  {method.total} orders · ${method.revenue.toLocaleString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs font-bold ${
                  successRate >= 90 ? 'text-[var(--success)]' :
                  successRate >= 70 ? 'text-[var(--accent-gold)]' :
                  'text-[var(--danger)]'
                }`}>
                  {successRate}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* No payment methods */}
      {methodKeys.length === 0 && (
        <div className="text-center py-6">
          <CreditCard size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)] font-medium">No payment data yet</p>
        </div>
      )}
    </div>
  )
}
