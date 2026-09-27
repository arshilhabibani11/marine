import { useMemo } from 'react'
import { Shield, AlertTriangle, UserX, Eye, Clock } from 'lucide-react'
import { orderCustomerEmail } from './orderFields'

interface Props {
  orders: any[]
  rfqs: any[]
}

export function SecurityCommandCenter({ orders, rfqs }: Props) {
  const data = useMemo(() => {
    const now = Date.now()
    const HOUR = 3600000

    // Analyze order patterns for suspicious activity
    const ordersByEmail: Record<string, { count: number; totalValue: number; timestamps: number[] }> = {}
    for (const order of orders) {
      const email = orderCustomerEmail(order)
      if (!email) continue
      if (!ordersByEmail[email]) ordersByEmail[email] = { count: 0, totalValue: 0, timestamps: [] }
      ordersByEmail[email].count++
      ordersByEmail[email].totalValue += order.total || 0
      ordersByEmail[email].timestamps.push(new Date(order.createdAt).getTime())
    }

    // Suspicious patterns
    const suspicious: Array<{
      type: string; description: string; severity: 'high' | 'medium' | 'low'; email: string;
    }> = []

    // Rapid order detection (5+ orders in 1 hour)
    for (const [email, data] of Object.entries(ordersByEmail)) {
      const recentTimestamps = data.timestamps.filter(t => now - t < 24 * HOUR)
      const hourlyBuckets: Record<number, number> = {}
      for (const t of recentTimestamps) {
        const hour = Math.floor(t / HOUR)
        hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1
      }
      const maxHourly = Math.max(...Object.values(hourlyBuckets), 0)
      if (maxHourly >= 5) {
        suspicious.push({
          type: 'rapid_orders',
          description: `${maxHourly} orders in 1 hour from ${email}`,
          severity: 'high', email,
        })
      }

      // High-value single order
      if (data.totalValue > 10000 && data.count === 1) {
        suspicious.push({
          type: 'high_value',
          description: `Single order of $${data.totalValue.toLocaleString()} from ${email}`,
          severity: 'medium', email,
        })
      }

      // Many cancelled orders
      const cancelledCount = orders.filter((o: any) =>
        orderCustomerEmail(o) === email && o.status === 'cancelled'
      ).length
      if (cancelledCount >= 3) {
        suspicious.push({
          type: 'cancel_pattern',
          description: `${cancelledCount} cancelled orders from ${email}`,
          severity: 'medium', email,
        })
      }
    }

    // RFQ spam detection
    const rfqsByEmail: Record<string, number> = {}
    for (const rfq of rfqs) {
      const email = rfq.email || ''
      if (!email) continue
      rfqsByEmail[email] = (rfqsByEmail[email] || 0) + 1
    }
    for (const [email, count] of Object.entries(rfqsByEmail)) {
      if (count >= 5) {
        suspicious.push({
          type: 'rfq_spam',
          description: `${count} RFQs submitted by ${email}`,
          severity: 'low', email,
        })
      }
    }

    // Security metrics
    const totalUniqueEmails = Object.keys(ordersByEmail).length
    const recentOrders24h = orders.filter((o: any) => now - new Date(o.createdAt).getTime() < 24 * HOUR).length
    const recentOrders1h = orders.filter((o: any) => now - new Date(o.createdAt).getTime() < HOUR).length
    const failedPayments = orders.filter((o: any) => o.status === 'cancelled' && o.cancelReason?.includes('payment')).length

    return {
      suspicious: suspicious.sort((a, b) => {
        const sev = { high: 3, medium: 2, low: 1 }
        return sev[b.severity] - sev[a.severity]
      }),
      totalUniqueEmails, recentOrders24h, recentOrders1h, failedPayments,
      totalOrders: orders.length,
    }
  }, [orders, rfqs])

  const severityConfig = {
    high: { color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10', label: 'High' },
    medium: { color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10', label: 'Medium' },
    low: { color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', label: 'Low' },
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-[var(--accent-teal)]" />
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Security Command Center</h2>
      </div>

      {/* Security metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Unique Customers', value: data.totalUniqueEmails.toString(), icon: UserX, color: 'text-[var(--accent-blue)]' },
          { label: 'Orders (24h)', value: data.recentOrders24h.toString(), icon: Clock, color: 'text-[var(--accent-teal)]' },
          { label: 'Orders (1h)', value: data.recentOrders1h.toString(), icon: Eye, color: data.recentOrders1h > 10 ? 'text-[var(--accent-gold)]' : 'text-[var(--text-primary)]' },
          { label: 'Failed Payments', value: data.failedPayments.toString(), icon: AlertTriangle, color: data.failedPayments > 5 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]' },
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

      {/* Suspicious activity */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={12} className="text-[var(--accent-gold)]" />
        <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Suspicious Activity ({data.suspicious.length})</h3>
      </div>

      {data.suspicious.length === 0 ? (
        <div className="text-center py-6">
          <Shield size={24} className="mx-auto text-[var(--success)] mb-2" />
          <p className="text-xs text-[var(--success)] font-medium">No suspicious activity detected</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          {data.suspicious.map((item, idx) => {
            const cfg = severityConfig[item.severity]
            return (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
                <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[0.5rem] font-bold ${cfg.bg} ${cfg.color} shrink-0`}>
                  {cfg.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
