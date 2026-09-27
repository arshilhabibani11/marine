import { useMemo } from 'react'
import { ShoppingCart, AlertTriangle, TrendingDown } from 'lucide-react'
import { isRefundedOrder } from './orderStatus'

interface Props {
  orders: any[]
}

export function CartAbandonmentTracker({ orders }: Props) {
  const data = useMemo(() => {
    // Categorize orders by completion status
    const total = orders.length
    const completed = orders.filter((o: any) => ['shipped', 'delivered'].includes(o.status))
    const processing = orders.filter((o: any) => ['confirmed', 'paid', 'processing', 'packed'].includes(o.status))
    const pending = orders.filter((o: any) => o.status === 'pending')
    const cancelled = orders.filter((o: any) => o.status === 'cancelled')
    const refunded = orders.filter((o: any) => isRefundedOrder(o))

    const completionRate = total > 0 ? (completed.length / total) * 100 : 0
    const abandonmentRate = total > 0 ? ((pending.length + cancelled.length) / total) * 100 : 0
    const revenueLost = cancelled.reduce((s: number, o: any) => s + (o.total || 0), 0)

    // Cancellation reasons breakdown
    const cancelReasons: Record<string, number> = {}
    for (const order of cancelled) {
      const reason = order.cancellationReason || order.reason || 'No reason given'
      cancelReasons[reason] = (cancelReasons[reason] || 0) + 1
    }

    // Weekly funnel
    const weeklyFunnel: Record<string, { started: number; completed: number; cancelled: number }> = {}
    for (const order of orders) {
      const week = getWeekStart(order.createdAt)
      if (!weeklyFunnel[week]) weeklyFunnel[week] = { started: 0, completed: 0, cancelled: 0 }
      weeklyFunnel[week].started++
      if (['shipped', 'delivered'].includes(order.status)) weeklyFunnel[week].completed++
      if (order.status === 'cancelled') weeklyFunnel[week].cancelled++
    }

    return {
      total, completedCount: completed.length, processingCount: processing.length,
      pendingCount: pending.length, cancelledCount: cancelled.length, refundedCount: refunded.length,
      completionRate, abandonmentRate, revenueLost,
      cancelReasons: Object.entries(cancelReasons).sort((a, b) => b[1] - a[1]),
    }
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart size={16} className="text-[var(--accent-gold)]" />
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Cart Abandonment Tracker</h2>
      </div>

      {/* Funnel visualization */}
      <div className="space-y-2 mb-4">
        {[
          { label: 'Order Started', count: data.total, pct: 100, color: 'bg-[var(--accent-blue)]' },
          { label: 'Processing', count: data.processingCount + data.completedCount, pct: data.total > 0 ? ((data.processingCount + data.completedCount) / data.total) * 100 : 0, color: 'bg-[var(--accent-gold)]' },
          { label: 'Completed', count: data.completedCount, pct: data.completionRate, color: 'bg-[var(--success)]' },
        ].map(stage => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] font-medium text-[var(--text-secondary)]">{stage.label}</span>
              <span className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">{stage.count} ({stage.pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-soft)] overflow-hidden">
              <div className={`h-full rounded-full ${stage.color} transition-all`} style={{ width: `${stage.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <TrendingDown size={14} className="mx-auto mb-1 text-[var(--danger)]" />
          <p className="font-mono text-lg font-extrabold text-[var(--danger)]">{data.abandonmentRate.toFixed(1)}%</p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Abandonment Rate</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <AlertTriangle size={14} className="mx-auto mb-1 text-[var(--accent-gold)]" />
          <p className="font-mono text-lg font-extrabold text-[var(--text-primary)]">${data.revenueLost.toLocaleString()}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Revenue Lost</p>
        </div>
      </div>

      {/* Cancellation reasons */}
      {data.cancelReasons.length > 0 && (
        <div>
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Cancellation Reasons</h3>
          <div className="space-y-1">
            {data.cancelReasons.slice(0, 5).map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between rounded-lg bg-[var(--surface-soft)] px-3 py-1.5">
                <span className="text-[0.625rem] text-[var(--text-secondary)] truncate">{reason}</span>
                <span className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)] shrink-0 ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr || Date.now())
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day
  d.setUTCDate(diff)
  return d.toISOString().split('T')[0]
}
