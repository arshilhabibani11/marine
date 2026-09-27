import { useMemo, useState } from 'react'
import { Bell, AlertTriangle, FileText, ShoppingCart, X } from 'lucide-react'
import { orderCustomerName } from './orderFields'

interface Props {
  alerts: any[]
  rfqs: any[]
  orders: any[]
}

export function SmartNotificationCenter({ alerts, rfqs, orders }: Props) {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'orders' | 'rfqs' | 'alerts'>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const notifications = useMemo(() => {
    const items: Array<{
      id: string; type: string; icon: any; color: string; bg: string;
      title: string; detail: string; priority: 'urgent' | 'normal' | 'low'; time: number;
    }> = []

    // Emergency RFQs (urgent)
    for (const rfq of rfqs.filter((r: any) => r.urgency === 'emergency' && r.status !== 'closed')) {
      items.push({
        id: `rfq-${rfq.id}`, type: 'rfqs',
        icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10',
        title: `🚨 Emergency RFQ — ${rfq.company || rfq.fullName || 'Customer'}`,
        detail: rfq.productDescription?.slice(0, 60) || 'Urgent inquiry',
        priority: 'urgent', time: new Date(rfq.createdAt).getTime(),
      })
    }

    // New RFQs
    for (const rfq of rfqs.filter((r: any) => r.status === 'new')) {
      items.push({
        id: `rfq-${rfq.id}`, type: 'rfqs',
        icon: FileText, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10',
        title: `New RFQ — ${rfq.company || rfq.fullName || 'Customer'}`,
        detail: rfq.productDescription?.slice(0, 60) || 'Product inquiry',
        priority: 'normal', time: new Date(rfq.createdAt).getTime(),
      })
    }

    // Pending orders
    for (const order of orders.filter((o: any) => o.status === 'pending').slice(0, 10)) {
      items.push({
        id: `order-${order.id}`, type: 'orders',
        icon: ShoppingCart, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10',
        title: `Order ${order.orderNumber || order.id?.slice(0, 8) || 'new'} — $${(order.total || 0).toLocaleString()}`,
        detail: `${orderCustomerName(order)} · ${(order.items || []).length} items`,
        priority: 'normal', time: new Date(order.createdAt).getTime(),
      })
    }

    // Danger alerts
    for (const alert of alerts.filter((a: any) => a.type === 'danger')) {
      items.push({
        id: `alert-${Math.random().toString(36).slice(2)}`, type: 'alerts',
        icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10',
        title: alert.message || alert.title || 'System Alert',
        detail: alert.description || 'Attention needed',
        priority: 'urgent', time: new Date(alert.createdAt || Date.now()).getTime(),
      })
    }

    // Warning alerts
    for (const alert of alerts.filter((a: any) => a.type === 'warning')) {
      items.push({
        id: `alert-${Math.random().toString(36).slice(2)}`, type: 'alerts',
        icon: AlertTriangle, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10',
        title: alert.message || alert.title || 'Warning',
        detail: alert.description || '',
        priority: 'low', time: new Date(alert.createdAt || Date.now()).getTime(),
      })
    }

    return items.filter(n => !dismissed.has(n.id)).sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1
      return b.time - a.time
    })
  }, [alerts, rfqs, orders, dismissed])

  const filtered = filter === 'all' ? notifications
    : notifications.filter(n => n.type === filter || (filter === 'urgent' && n.priority === 'urgent'))

  const urgentCount = notifications.filter(n => n.priority === 'urgent').length

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={16} className="text-[var(--accent-gold)]" />
            {urgentCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--danger)] text-[0.375rem] font-bold text-[var(--btn-danger-text)]">
                {urgentCount}
              </span>
            )}
          </div>
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Smart Notifications</h2>
        </div>
        <span className="text-[0.625rem] text-[var(--text-muted)] font-medium">{notifications.length} active</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(['all', 'urgent', 'orders', 'rfqs', 'alerts'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.625rem] font-bold transition-all ${
              filter === f ? 'bg-[var(--accent-gold)] text-[var(--btn-blue-text)]' : 'bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Bell size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)] font-medium">All clear — no notifications</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {filtered.slice(0, 20).map(n => {
            const Icon = n.icon
            return (
              <div key={n.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors ${
                n.priority === 'urgent' ? 'border border-[var(--danger)]/20 bg-[var(--danger)]/5' : ''
              }`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${n.bg}`}>
                  <Icon size={12} className={n.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{n.title}</p>
                  <p className="text-[0.625rem] text-[var(--text-muted)] truncate">{n.detail}</p>
                </div>
                <button onClick={() => setDismissed(prev => new Set(prev).add(n.id))}
                  className="shrink-0 p-1 rounded-md hover:bg-[var(--border)] transition-colors">
                  <X size={10} className="text-[var(--text-muted)]" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
