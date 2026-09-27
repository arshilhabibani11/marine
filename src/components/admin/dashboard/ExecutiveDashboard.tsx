import { useMemo } from 'react'
import { Crown, TrendingUp, ShoppingCart, FileText, AlertTriangle, Package, DollarSign } from 'lucide-react'

interface Props {
  stats: any
  orders: any[]
  rfqs: any[]
  alerts: any[]
  products: any[]
}

export function ExecutiveDashboard({ orders, rfqs, alerts, products }: Props) {
  const data = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000

    const activeOrders = orders.filter(o => !['cancelled', 'delivered'].includes(o.status))
    const todayOrders = orders.filter(o => o.createdAt?.startsWith(new Date().toISOString().split('T')[0]))
    const thisWeekOrders = orders.filter(o => (now - new Date(o.createdAt).getTime()) < 7 * DAY)
    const thisMonthOrders = orders.filter(o => (now - new Date(o.createdAt).getTime()) < 30 * DAY)

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.status !== 'cancelled' ? (o.total || 0) : 0), 0)
    const monthRevenue = thisMonthOrders.reduce((s: number, o: any) => s + (o.status !== 'cancelled' ? (o.total || 0) : 0), 0)
    const weekRevenue = thisWeekOrders.reduce((s: number, o: any) => s + (o.status !== 'cancelled' ? (o.total || 0) : 0), 0)
    const todayRevenue = todayOrders.reduce((s: number, o: any) => s + (o.status !== 'cancelled' ? (o.total || 0) : 0), 0)

    const pendingRfqs = rfqs.filter(r => r.status !== 'won' && r.status !== 'lost' && r.status !== 'closed')
    const emergencyRfqs = rfqs.filter(r => r.urgency === 'emergency' && r.status !== 'closed')
    const dangerAlerts = alerts.filter((a: any) => a.type === 'danger')

    const lowStockProducts = products.filter((p: any) => (p.stockCount || 0) <= (p.lowStockThreshold || 10))
    const outOfStock = products.filter((p: any) => (p.stockCount || 0) === 0)

    // Revenue per product category
    const categoryRevenue: Record<string, number> = {}
    for (const order of orders) {
      if (order.status === 'cancelled') continue
      for (const item of order.items || []) {
        const cat = item.category || 'Uncategorized'
        categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (item.price || 0) * (item.quantity || 1)
      }
    }
    const topCategory = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1])[0]

    return {
      totalRevenue, monthRevenue, weekRevenue, todayRevenue,
      activeOrders: activeOrders.length, totalOrders: orders.length,
      pendingRfqs: pendingRfqs.length, emergencyRfqs: emergencyRfqs.length,
      alertCount: dangerAlerts.length + emergencyRfqs.length,
      lowStockCount: lowStockProducts.length, outOfStockCount: outOfStock.length,
      topCategory: topCategory ? { name: topCategory[0], revenue: topCategory[1] } : null,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.filter((o: any) => o.status !== 'cancelled').length : 0,
    }
  }, [orders, rfqs, alerts, products])

  const bigStats = [
    { label: 'Total Revenue', value: `$${data.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
    { label: 'Active Orders', value: data.activeOrders.toString(), icon: ShoppingCart, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
    { label: 'Pending RFQs', value: data.pendingRfqs.toString(), icon: FileText, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
    { label: 'Low Stock Items', value: data.lowStockCount.toString(), icon: Package, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
    { label: 'Urgent Alerts', value: data.alertCount.toString(), icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10' },
    { label: 'Avg Order Value', value: `$${Math.round(data.avgOrderValue).toLocaleString()}`, icon: TrendingUp, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  ]

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-5">
        <Crown size={18} className="text-[var(--accent-gold)]" />
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Executive Dashboard</h2>
      </div>

      {/* Big stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {bigStats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl bg-[var(--surface-soft)] p-4 text-center">
              <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                <Icon size={16} className={s.color} />
              </div>
              <p className="font-display text-xl font-extrabold text-[var(--text-primary)]">{s.value}</p>
              <p className="text-[0.625rem] text-[var(--text-muted)] font-bold uppercase mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Period breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Today', revenue: data.todayRevenue, orders: orders.filter(o => o.createdAt?.startsWith(new Date().toISOString().split('T')[0])).length },
          { label: 'This Week', revenue: data.weekRevenue, orders: orders.filter(o => (Date.now() - new Date(o.createdAt).getTime()) < 7 * 86400000).length },
          { label: 'This Month', revenue: data.monthRevenue, orders: orders.filter(o => (Date.now() - new Date(o.createdAt).getTime()) < 30 * 86400000).length },
        ].map(p => (
          <div key={p.label} className="rounded-xl border border-[var(--border)] p-3 text-center">
            <p className="text-[0.5rem] font-bold text-[var(--text-muted)] uppercase">{p.label}</p>
            <p className="font-mono text-sm font-extrabold text-[var(--text-primary)] mt-1">${p.revenue.toLocaleString()}</p>
            <p className="text-[0.5rem] text-[var(--text-muted)]">{p.orders} orders</p>
          </div>
        ))}
      </div>

      {/* Top category */}
      {data.topCategory && (
        <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 flex items-center justify-between">
          <span className="text-[0.625rem] text-[var(--text-muted)]">Top Category</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{data.topCategory.name} — ${data.topCategory.revenue.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
