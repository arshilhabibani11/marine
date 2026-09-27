import { useMemo } from 'react'
import { RotateCcw, XCircle, TrendingDown } from 'lucide-react'
import { isCancelledOrRefunded } from './orderStatus'

interface Props {
  orders: any[]
}

export function ReturnAnalytics({ orders }: Props) {
  const analysis = useMemo(() => {
    const cancelled = orders.filter(isCancelledOrRefunded)
    const total = orders.length
    const returnRate = total > 0 ? Math.round((cancelled.length / total) * 100) : 0
    const totalRefunded = cancelled.reduce((s, o) => s + (o.total || 0), 0)

    // Group by cancellation reason
    const reasons = cancelled.reduce((acc, o) => {
      const reason = o.cancellationReason || o.cancelReason || 'Not specified'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const reasonList = Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count: count as number }))
      .sort((a, b) => b.count - a.count)

    const maxReasonCount = reasonList.length > 0 ? reasonList[0].count : 1

    // Monthly trend (last 6 months)
    const monthlyReturns: Record<string, { cancelled: number; total: number }> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      monthlyReturns[key] = { cancelled: 0, total: 0 }
    }
    for (const order of orders) {
      const month = order.createdAt?.slice(0, 7)
      if (month && monthlyReturns[month]) {
        monthlyReturns[month].total++
        if (isCancelledOrRefunded(order)) {
          monthlyReturns[month].cancelled++
        }
      }
    }

    const monthlyTrend = Object.entries(monthlyReturns).map(([month, data]) => ({
      month,
      rate: data.total > 0 ? Math.round((data.cancelled / data.total) * 100) : 0,
      count: data.cancelled,
      total: data.total,
    }))

    return { totalOrders: total, cancelledCount: cancelled.length, returnRate, totalRefunded, reasonList, maxReasonCount, monthlyTrend }
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-[var(--accent-gold)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
            Return Analytics
          </h2>
        </div>
        <span className={`text-[0.625rem] font-bold ${
          analysis.returnRate > 10 ? 'text-[var(--danger)]' :
          analysis.returnRate > 5 ? 'text-[var(--accent-gold)]' :
          'text-[var(--success)]'
        }`}>
          {analysis.returnRate}% return rate
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <XCircle size={14} className="mx-auto text-[var(--danger)] mb-1" />
          <p className="font-mono text-lg font-extrabold text-[var(--text-primary)]">{analysis.cancelledCount}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Returns</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <TrendingDown size={14} className="mx-auto text-[var(--accent-gold)] mb-1" />
          <p className="font-mono text-lg font-extrabold text-[var(--danger)]">
            ${analysis.totalRefunded.toLocaleString()}
          </p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Refunded</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <RotateCcw size={14} className="mx-auto text-[var(--text-muted)] mb-1" />
          <p className="font-mono text-lg font-extrabold text-[var(--text-primary)]">{analysis.totalOrders}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Total Orders</p>
        </div>
      </div>

      {/* Cancellation reasons */}
      {analysis.reasonList.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Cancellation Reasons
          </h3>
          <div className="space-y-1.5">
            {analysis.reasonList.slice(0, 5).map(r => (
              <div key={r.reason} className="flex items-center gap-2">
                <span className="text-[0.625rem] text-[var(--text-secondary)] truncate w-24 shrink-0">{r.reason}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent-gold)]"
                    style={{ width: `${(r.count / (analysis.maxReasonCount as number)) * 100}%` }} />
                </div>
                <span className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)] w-4 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly trend */}
      {analysis.monthlyTrend.length > 0 && (
        <div>
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Monthly Return Rate (Last 6 Months)
          </h3>
          <div className="flex items-end gap-1 h-16">
            {analysis.monthlyTrend.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                  <div className="rounded-lg bg-[var(--navy-deep)] text-white px-2 py-1 text-[0.5rem] font-bold whitespace-nowrap shadow-lg">
                    {m.rate}% ({m.count}/{m.total})
                  </div>
                </div>
                <div className="w-full rounded-t-sm bg-[var(--accent-gold)]/60 min-h-[2px]"
                  style={{ height: `${m.rate > 0 ? Math.max(m.rate, 8) : 0}%` }}
                  title={`${m.month}: ${m.rate}%`} />
                <span className="text-[0.4rem] text-[var(--text-muted)]">
                  {m.month.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
