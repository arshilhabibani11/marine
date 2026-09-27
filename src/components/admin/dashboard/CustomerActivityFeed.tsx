import { useMemo } from 'react'
import { Activity, ShoppingCart, FileText } from 'lucide-react'
import { orderCustomerName } from './orderFields'

interface Props {
  orders: any[]
  rfqs: any[]
}

export function CustomerActivityFeed({ orders, rfqs }: Props) {
  const feed = useMemo(() => {
    const items: Array<{
      type: string; icon: any; color: string; bg: string;
      title: string; detail: string; time: Date; sortTime: number;
    }> = []

    // Orders as activities
    for (const order of orders) {
      const createdAt = new Date(order.createdAt || Date.now())
      items.push({
        type: 'order',
        icon: ShoppingCart,
        color: 'text-[var(--accent-blue)]',
        bg: 'bg-[var(--accent-blue)]/10',
        title: `Order ${order.orderNumber || order.id?.slice(0, 8) || 'placed'}`,
        detail: `${orderCustomerName(order)} — $${(order.total || 0).toLocaleString()} (${order.status || 'pending'})`,
        time: createdAt,
        sortTime: createdAt.getTime(),
      })
    }

    // RFQs as activities
    for (const rfq of rfqs) {
      const createdAt = new Date(rfq.createdAt || Date.now())
      const isEmergency = rfq.urgency === 'emergency'
      items.push({
        type: 'rfq',
        icon: FileText,
        color: isEmergency ? 'text-[var(--danger)]' : 'text-[var(--accent-teal)]',
        bg: isEmergency ? 'bg-[var(--danger)]/10' : 'bg-[var(--accent-teal)]/10',
        title: `${isEmergency ? '🚨 Emergency RFQ' : 'New RFQ'} from ${rfq.company || rfq.fullName || 'Customer'}`,
        detail: rfq.productDescription?.slice(0, 60) || 'Product inquiry',
        time: createdAt,
        sortTime: createdAt.getTime(),
      })
    }

    return items.sort((a, b) => b.sortTime - a.sortTime)
  }, [orders, rfqs])

  const formatTime = (date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--accent-teal)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Customer Activity Feed</h2>
        </div>
        <span className="text-[0.625rem] text-[var(--text-muted)] font-medium">{feed.length} events</span>
      </div>

      {feed.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {feed.slice(0, 20).map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx} className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                  <Icon size={12} className={item.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-[0.625rem] text-[var(--text-muted)] truncate">{item.detail}</p>
                </div>
                <span className="text-[0.5rem] text-[var(--text-muted)] whitespace-nowrap shrink-0 mt-0.5">
                  {formatTime(item.time)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
