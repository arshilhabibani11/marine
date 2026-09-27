import { useMemo } from 'react'
import { Package, Truck, CheckCircle, Clock, XCircle, CreditCard } from 'lucide-react'
import { isCancelledOrRefunded } from './orderStatus'

interface Props {
  orders: any[]
}

// Mirrors the backend order status flow (orderMutations.STATUS_FLOW). Every
// status must appear here or those orders vanish from the pipeline.
const stages = [
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
  { key: 'confirmed', label: 'Confirmed', icon: Package, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  { key: 'paid', label: 'Paid', icon: CreditCard, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  { key: 'processing', label: 'Processing', icon: Package, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  { key: 'packed', label: 'Packed', icon: Package, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  { key: 'shipped', label: 'Shipped', icon: Truck, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10' },
]

export function OrderFulfillment({ orders }: Props) {
  const { counts, cancelled, active } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of stages) {
      counts[s.key] = 0
    }
    let cancelled = 0
    for (const order of orders) {
      const status = order.status || ''
      if (counts[status] !== undefined) {
        counts[status]++
      } else if (isCancelledOrRefunded(order)) {
        cancelled++
      }
    }
    return { counts, cancelled, active: orders.length - cancelled }
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
          Order Fulfillment Pipeline
        </h2>
        <span className="text-[0.625rem] text-[var(--text-muted)] font-medium">
          {orders.length} total orders
        </span>
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="flex items-center gap-1 shrink-0">
              <div className={`flex flex-col items-center rounded-xl px-4 py-3 ${s.bg} min-w-[80px] transition-all hover:-translate-y-0.5`}>
                <Icon size={18} className={s.color} />
                <span className="font-display text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {counts[s.key] || 0}
                </span>
                <span className="text-[0.5rem] font-bold text-[var(--text-muted)] uppercase">
                  {s.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div className="text-[var(--text-muted)] text-xs">→</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cancelled summary */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
        {cancelled > 0 ? (
          <div className="flex items-center gap-2 text-xs text-[var(--danger)]">
            <XCircle size={14} />
            <span className="font-medium">{cancelled} cancelled order{cancelled !== 1 ? 's' : ''}</span>
          </div>
        ) : (
          <span className="text-xs text-[var(--success)] font-medium">No cancelled orders</span>
        )}
        <span className="text-[0.625rem] text-[var(--text-muted)]">
          {active} active
        </span>
      </div>
    </div>
  )
}
