import { useMemo } from 'react'
import { DollarSign, TrendingDown, XCircle } from 'lucide-react'
import { isCancelledOrRefunded } from './orderStatus'

interface Props {
  orders: any[]
}

export function MoneyLeakDetector({ orders }: Props) {
  const analysis = useMemo(() => {
    const validOrders = orders.filter(o => !isCancelledOrRefunded(o))
    const cancelledOrders = orders.filter(o => isCancelledOrRefunded(o))

    // Revenue leakage from cancellations
    const cancelledRevenue = cancelledOrders.reduce((s, o) => s + (o.total || 0), 0)

    // Discount leakage (subtotal - total)
    let totalDiscounts = 0
    let discountCount = 0
    for (const order of validOrders) {
      const subtotal = order.subtotal || 0
      const total = order.total || 0
      if (subtotal > total && subtotal > 0) {
        totalDiscounts += subtotal - total
        discountCount++
      }
    }

    // Cancellation rate
    const cancelRate = orders.length > 0
      ? Math.round((cancelledOrders.length / orders.length) * 100)
      : 0

    // Average discount per discounted order
    const avgDiscount = discountCount > 0 ? totalDiscounts / discountCount : 0

    // Total estimated leakage
    const totalLeakage = cancelledRevenue + totalDiscounts

    // Revenue without leakage
    const grossRevenue = orders.reduce((s, o) => s + (o.subtotal || o.total || 0), 0)
    const leakagePercentage = grossRevenue > 0
      ? Math.round((totalLeakage / grossRevenue) * 100)
      : 0

    return {
      cancelledRevenue,
      cancelledCount: cancelledOrders.length,
      totalDiscounts,
      discountCount,
      avgDiscount,
      cancelRate,
      totalLeakage,
      leakagePercentage,
      grossRevenue,
    }
  }, [orders])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-[var(--danger)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
            Money Leakage Detector
          </h2>
        </div>
        <span className={`text-[0.625rem] font-bold ${
          analysis.leakagePercentage > 10 ? 'text-[var(--danger)]' :
          analysis.leakagePercentage > 5 ? 'text-[var(--accent-gold)]' :
          'text-[var(--success)]'
        }`}>
          {analysis.leakagePercentage}% of revenue
        </span>
      </div>

      {/* Total leakage alert */}
      <div className={`rounded-xl p-4 mb-4 ${
        analysis.totalLeakage > 0
          ? 'bg-[var(--danger)]/5 border border-[var(--danger)]/20'
          : 'bg-[var(--success)]/5 border border-[var(--success)]/20'
      }`}>
        <p className="text-[0.625rem] text-[var(--text-muted)] font-bold uppercase mb-1">
          Total Estimated Leakage
        </p>
        <p className={`font-display text-2xl font-extrabold ${
          analysis.totalLeakage > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'
        }`}>
          ${analysis.totalLeakage.toLocaleString()}
        </p>
        {analysis.grossRevenue > 0 && (
          <p className="text-[0.625rem] text-[var(--text-muted)] mt-1">
            Out of ${analysis.grossRevenue.toLocaleString()} gross revenue
          </p>
        )}
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        {/* Cancellations */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-[var(--danger)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Cancelled Orders</p>
              <p className="text-[0.625rem] text-[var(--text-muted)]">{analysis.cancelledCount} orders · {analysis.cancelRate}% cancel rate</p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--danger)]">
            ${analysis.cancelledRevenue.toLocaleString()}
          </span>
        </div>

        {/* Discounts */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-[var(--accent-gold)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Discounts Given</p>
              <p className="text-[0.625rem] text-[var(--text-muted)]">{analysis.discountCount} orders · avg ${Math.round(analysis.avgDiscount)}/order</p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--accent-gold)]">
            ${analysis.totalDiscounts.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.cancelRate > 15 && (
        <div className="mt-3 rounded-lg bg-[var(--accent-gold)]/5 border border-[var(--accent-gold)]/20 p-3">
          <p className="text-[0.625rem] text-[var(--accent-gold)] font-bold">
            ⚠️ Cancellation rate ({analysis.cancelRate}%) is above 15% — review return policy
          </p>
        </div>
      )}
    </div>
  )
}
