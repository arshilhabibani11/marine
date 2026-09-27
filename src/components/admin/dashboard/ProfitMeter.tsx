import { useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { isCancelledOrRefunded } from './orderStatus'

interface Props {
  orders: any[]
  products: any[]
}

export function ProfitMeter({ orders }: Props) {
  const data = useMemo(() => {
    const completedOrders = orders.filter((o: any) => !isCancelledOrRefunded(o))

    const totalRevenue = completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
    const totalSubtotal = completedOrders.reduce((s: number, o: any) => s + (o.subtotal || 0), 0)
    const totalDiscounts = totalSubtotal - totalRevenue
    const totalTax = completedOrders.reduce((s: number, o: any) => s + (o.tax || 0), 0)
    const totalShipping = completedOrders.reduce((s: number, o: any) => s + (o.shipping || 0), 0)

    // Estimate COGS from product sale prices (assume 40-60% margin for marine equipment)
    const avgMargin = 0.55 // 55% estimated gross margin
    const estimatedCOGS = totalRevenue * (1 - avgMargin)
    const estimatedGrossProfit = totalRevenue - estimatedCOGS
    const grossMargin = totalRevenue > 0 ? (estimatedGrossProfit / totalRevenue) * 100 : 0

    // Monthly revenue trend
    const monthlyRevenue: Record<string, number> = {}
    for (const order of completedOrders) {
      const month = order.createdAt?.slice(0, 7) || 'unknown'
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (order.total || 0)
    }
    const months = Object.entries(monthlyRevenue).sort((a, b) => a[0].localeCompare(b[0]))
    const trend = months.length >= 2 ? months[months.length - 1][1] - months[months.length - 2][1] : 0
    const trendPct = months.length >= 2 && months[months.length - 2][1] > 0
      ? ((trend / months[months.length - 2][1]) * 100)
      : 0

    // Revenue breakdown
    const cancelledRevenue = orders.filter((o: any) => o.status === 'cancelled').reduce((s: number, o: any) => s + (o.total || 0), 0)

    return {
      totalRevenue, estimatedCOGS, estimatedGrossProfit, grossMargin,
      totalDiscounts, totalTax, totalShipping, cancelledRevenue,
      trendPct, orderCount: completedOrders.length,
    }
  }, [orders])

  const circumference = 2 * Math.PI * 45
  const dashOffset = circumference - (circumference * Math.min(data.grossMargin, 100)) / 100

  const marginColor = data.grossMargin >= 50 ? 'var(--success)'
    : data.grossMargin >= 30 ? 'var(--accent-gold)'
    : 'var(--danger)'

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-[var(--accent-gold)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Profit Meter</h2>
        </div>
        <div className="flex items-center gap-1">
          {data.trendPct !== 0 && (
            <>
              {data.trendPct > 0 ? <TrendingUp size={12} className="text-[var(--success)]" /> : <TrendingDown size={12} className="text-[var(--danger)]" />}
              <span className={`text-[0.625rem] font-bold ${data.trendPct > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {data.trendPct > 0 ? '+' : ''}{data.trendPct.toFixed(1)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Gauge */}
      <div className="flex justify-center mb-5">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-soft)" strokeWidth="8" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={marginColor} strokeWidth="8"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-mono text-2xl font-extrabold text-[var(--text-primary)]">{Math.round(data.grossMargin)}%</p>
            <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Gross Margin</p>
          </div>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="space-y-2">
        {[
          { label: 'Total Revenue', value: data.totalRevenue, color: 'text-[var(--text-primary)]' },
          { label: 'Est. COGS', value: data.estimatedCOGS, color: 'text-[var(--danger)]' },
          { label: 'Gross Profit', value: data.estimatedGrossProfit, color: 'text-[var(--success)]' },
          { label: 'Discounts Given', value: data.totalDiscounts, color: 'text-[var(--accent-gold)]' },
          { label: 'Shipping Collected', value: data.totalShipping, color: 'text-[var(--accent-blue)]' },
          { label: 'Cancelled Revenue', value: data.cancelledRevenue, color: 'text-[var(--danger)]' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between py-1">
            <span className="text-[0.625rem] text-[var(--text-muted)]">{item.label}</span>
            <span className={`font-mono text-xs font-bold ${item.color}`}>${Math.abs(item.value).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-center">
        <p className="text-[0.5rem] text-[var(--text-muted)] font-medium">
          Based on estimated 55% margin for marine equipment · {data.orderCount} orders analyzed
        </p>
      </div>
    </div>
  )
}
