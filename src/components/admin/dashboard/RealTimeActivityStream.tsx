import { useMemo } from 'react'
import { Radio, ShoppingCart, FileText, Package, UserX, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { orderCustomerName } from './orderFields'

interface Props {
  orders: any[]
  rfqs: any[]
  alerts: any[]
}

const ACTION_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  order_created: { icon: ShoppingCart, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  order_shipped: { icon: Package, color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  order_delivered: { icon: CheckCircle, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10' },
  order_cancelled: { icon: UserX, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10' },
  rfq_new: { icon: FileText, color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
  rfq_emergency: { icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10' },
  alert: { icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10' },
}

export function RealTimeActivityStream({ orders, rfqs, alerts }: Props) {
  const stream = useMemo(() => {
    const items: Array<{
      id: string; type: string; title: string; detail: string;
      time: number; icon: any; color: string; bg: string;
    }> = []

    // Recent orders (last 20)
    const recentOrders = [...orders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15)
    for (const order of recentOrders) {
      const status = order.status || 'pending'
      const actionKey = status === 'cancelled' ? 'order_cancelled'
        : status === 'shipped' ? 'order_shipped'
        : status === 'delivered' ? 'order_delivered'
        : 'order_created'
      const cfg = ACTION_ICONS[actionKey]
      items.push({
        id: `order-${order.id}`,
        type: actionKey,
        title: `Order ${order.orderNumber || order.id?.slice(0, 8) || 'new'}`,
        detail: `${orderCustomerName(order)} · $${(order.total || 0).toLocaleString()}`,
        time: new Date(order.createdAt).getTime(),
        ...cfg,
      })
    }

    // Recent RFQs
    const recentRfqs = [...rfqs].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
    for (const rfq of recentRfqs) {
      const isEmergency = rfq.urgency === 'emergency'
      const cfg = isEmergency ? ACTION_ICONS.rfq_emergency : ACTION_ICONS.rfq_new
      items.push({
        id: `rfq-${rfq.id}`,
        type: isEmergency ? 'rfq_emergency' : 'rfq_new',
        title: `${isEmergency ? '🚨 ' : ''}RFQ from ${rfq.company || rfq.fullName || 'Customer'}`,
        detail: rfq.productDescription?.slice(0, 50) || 'Inquiry',
        time: new Date(rfq.createdAt).getTime(),
        ...cfg,
      })
    }

    // Alerts
    for (const alert of alerts.slice(0, 5)) {
      items.push({
        id: `alert-${Math.random().toString(36).slice(2)}`,
        type: 'alert',
        title: alert.message || alert.title || 'System Alert',
        detail: alert.description || alert.type || 'Attention needed',
        time: new Date(alert.createdAt || Date.now()).getTime(),
        ...ACTION_ICONS.alert,
      })
    }

    return items.sort((a, b) => b.time - a.time).slice(0, 25)
  }, [orders, rfqs, alerts])

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio size={16} className="text-[var(--danger)]" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--danger)] animate-pulse" />
          </div>
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Live Activity Stream</h2>
        </div>
        <span className="flex items-center gap-1 text-[0.625rem] text-[var(--text-muted)]">
          <Clock size={10} /> Auto-refresh
        </span>
      </div>

      {stream.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-6">No activity yet</p>
      ) : (
        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {stream.map(item => {
            const Icon = item.icon
            return (
              <div key={item.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-soft)] transition-colors">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${item.bg}`}>
                  <Icon size={10} className={item.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.625rem] font-semibold text-[var(--text-primary)] truncate">{item.title}</p>
                  <p className="text-[0.5rem] text-[var(--text-muted)] truncate">{item.detail}</p>
                </div>
                <span className="text-[0.5rem] text-[var(--text-muted)] shrink-0">{formatTime(item.time)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
