import { useMemo, useState } from 'react'
import { Clock, CheckCircle, Package, Truck, XCircle, CreditCard } from 'lucide-react'
import { orderCustomerName } from './orderFields'

interface Props {
  orders: any[]
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  pending: { color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10', icon: Clock, label: 'Pending' },
  confirmed: { color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', icon: CheckCircle, label: 'Confirmed' },
  'payment-pending': { color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10', icon: CreditCard, label: 'Payment Pending' },
  paid: { color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10', icon: CreditCard, label: 'Paid' },
  processing: { color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', icon: Package, label: 'Processing' },
  packed: { color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10', icon: Package, label: 'Packed' },
  shipped: { color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', icon: Truck, label: 'Shipped' },
  delivered: { color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10', icon: XCircle, label: 'Cancelled' },
  refunded: { color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10', icon: XCircle, label: 'Refunded' },
}

const PIPELINE = ['pending', 'confirmed', 'paid', 'processing', 'packed', 'shipped', 'delivered']

export function OrderTimeline({ orders }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const timeline = useMemo(() => {
    const sorted = [...orders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const filtered = selectedStatus === 'all' ? sorted : sorted.filter((o: any) => o.status === selectedStatus)
    return filtered.slice(0, 25).map((order: any) => {
      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
      return { ...order, config: cfg }
    })
  }, [orders, selectedStatus])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length }
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1
    }
    return counts
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[var(--accent-blue)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Order Timeline</h2>
        </div>
        <span className="text-[0.625rem] text-[var(--text-muted)] font-medium">{orders.length} orders</span>
      </div>

      {/* Pipeline visual */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {PIPELINE.map((step, idx) => {
          const cfg = STATUS_CONFIG[step]
          const count = statusCounts[step] || 0
          const Icon = cfg.icon
          return (
            <div key={step} className="flex items-center">
              <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[0.5rem] font-bold ${cfg.bg} ${cfg.color}`}>
                <Icon size={10} />
                <span>{count}</span>
              </div>
              {idx < PIPELINE.length - 1 && <span className="text-[var(--text-muted)] mx-0.5">→</span>}
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {['all', 'pending', 'confirmed', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'].map(f => (
          <button key={f} onClick={() => setSelectedStatus(f)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.625rem] font-bold transition-all ${
              selectedStatus === f ? 'bg-[var(--accent-gold)] text-[var(--btn-blue-text)]' : 'bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            {f === 'all' ? `All (${statusCounts.all || 0})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${statusCounts[f] || 0})`}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {timeline.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-6">No orders match this filter</p>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {timeline.map((order: any) => {
            const Icon = order.config.icon
            return (
              <div key={order.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${order.config.bg}`}>
                  <Icon size={12} className={order.config.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {order.orderNumber || order.id?.slice(0, 8) || 'Order'}
                    </p>
                    <span className={`rounded-md px-1.5 py-0.5 text-[0.5rem] font-bold ${order.config.bg} ${order.config.color}`}>
                      {order.config.label}
                    </span>
                  </div>
                  <p className="text-[0.625rem] text-[var(--text-muted)]">
                    {orderCustomerName(order)} · {(order.items || []).length} items
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">
                    ${(order.total || 0).toLocaleString()}
                  </p>
                  <p className="text-[0.5rem] text-[var(--text-muted)]">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
