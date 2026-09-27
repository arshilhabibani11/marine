import { useMemo } from 'react'
import { BarChart3, TrendingUp, ShoppingCart, Percent, DollarSign } from 'lucide-react'
import { isCancelledOrRefunded, isRefundedOrder } from './orderStatus'

interface Props {
  orders: any[]
}

export function FinancialCommandCenter({ orders }: Props) {
  const data = useMemo(() => {
    const completed = orders.filter((o: any) => !isCancelledOrRefunded(o))
    const cancelled = orders.filter((o: any) => o.status === 'cancelled')
    const refunded = orders.filter((o: any) => isRefundedOrder(o))

    const totalRevenue = completed.reduce((s: number, o: any) => s + (o.total || 0), 0)
    const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0
    const cancelRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0
    const refundRate = orders.length > 0 ? (refunded.length / orders.length) * 100 : 0
    const totalRefunded = refunded.reduce((s: number, o: any) => s + (o.total || 0), 0)

    // Payment method breakdown
    const paymentMethods: Record<string, { count: number; revenue: number }> = {}
    for (const order of completed) {
      const method = order.paymentMethod || 'Unknown'
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, revenue: 0 }
      paymentMethods[method].count++
      paymentMethods[method].revenue += order.total || 0
    }

    // Monthly revenue
    const monthly: Record<string, number> = {}
    for (const order of completed) {
      const month = order.createdAt?.slice(0, 7) || 'unknown'
      monthly[month] = (monthly[month] || 0) + (order.total || 0)
    }
    const monthEntries = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]))
    const latestMonth = monthEntries.length > 0 ? monthEntries[monthEntries.length - 1] : null
    const prevMonth = monthEntries.length > 1 ? monthEntries[monthEntries.length - 2] : null
    const revenueGrowth = prevMonth && prevMonth[1] > 0 ? ((latestMonth![1] - prevMonth[1]) / prevMonth[1]) * 100 : 0

    // Order size distribution
    const sizes = completed.map((o: any) => o.total || 0).sort((a, b) => a - b)
    const median = sizes.length > 0 ? sizes[Math.floor(sizes.length / 2)] : 0
    const p90 = sizes.length > 0 ? sizes[Math.floor(sizes.length * 0.9)] : 0

    return {
      totalRevenue, avgOrderValue, cancelRate, refundRate, totalRefunded,
      paymentMethods, revenueGrowth, median, p90,
      totalOrders: orders.length, completedOrders: completed.length,
      cancelledCount: cancelled.length, refundedCount: refunded.length,
    }
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-[var(--accent-gold)]" />
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Financial Command Center</h2>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Total Revenue', value: `$${data.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[var(--accent-gold)]' },
          { label: 'Avg Order Value', value: `$${Math.round(data.avgOrderValue).toLocaleString()}`, icon: ShoppingCart, color: 'text-[var(--accent-blue)]' },
          { label: 'Revenue Growth', value: `${data.revenueGrowth >= 0 ? '+' : ''}${data.revenueGrowth.toFixed(1)}%`, icon: TrendingUp, color: data.revenueGrowth >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
          { label: 'Cancel Rate', value: `${data.cancelRate.toFixed(1)}%`, icon: Percent, color: data.cancelRate > 15 ? 'text-[var(--danger)]' : 'text-[var(--accent-teal)]' },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
              <Icon size={14} className={`mx-auto mb-1 ${m.color}`} />
              <p className="font-mono text-sm font-extrabold text-[var(--text-primary)]">{m.value}</p>
              <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">{m.label}</p>
            </div>
          )
        })}
      </div>

      {/* Payment methods */}
      {Object.keys(data.paymentMethods).length > 0 && (
        <div className="mb-4">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Payment Methods</h3>
          <div className="space-y-1.5">
            {Object.entries(data.paymentMethods).map(([method, info]) => (
              <div key={method} className="flex items-center justify-between rounded-lg bg-[var(--surface-soft)] px-3 py-1.5">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{method}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">${info.revenue.toLocaleString()}</span>
                  <span className="text-[0.5rem] text-[var(--text-muted)]">{info.count} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Completed', value: data.completedOrders, color: 'text-[var(--success)]' },
          { label: 'Cancelled', value: data.cancelledCount, color: 'text-[var(--danger)]' },
          { label: 'Refunded', value: data.refundedCount, color: 'text-[var(--accent-gold)]' },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-[var(--surface-soft)] p-2 text-center">
            <p className={`font-mono text-sm font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[0.5rem] text-[var(--text-muted)] font-bold">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
