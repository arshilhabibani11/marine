import { ShoppingCart, Loader2, RefreshCw } from 'lucide-react'
import { useLiveOrders } from '../../../hooks/useLiveOrders'
import { orderCustomerName } from './orderFields'

interface Props {
  orders?: any[]
  loading?: boolean
}

export function LiveSalesTracker({ orders: propOrders, loading: propLoading }: Props = {}) {
  const hook = useLiveOrders(30000)
  const orders = propOrders ?? hook.orders
  const loading = propLoading ?? hook.loading
  const refresh = hook.refresh

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-[var(--accent-teal)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
            Live Sales
          </h2>
          <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
        </div>
        <button
          onClick={refresh}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--accent-gold)]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCart size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)] font-medium">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {orders.slice(0, 15).map((order) => {
            const statusColor =
              order.status === 'delivered' ? 'bg-[var(--success)]' :
              order.status === 'shipped' ? 'bg-[var(--accent-blue)]' :
              order.status === 'cancelled' ? 'bg-[var(--danger)]' :
              order.status === 'confirmed' ? 'bg-[var(--accent-teal)]' :
              'bg-[var(--accent-gold)]'

            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {order.orderNumber || order.id}
                    </p>
                    <p className="text-[0.625rem] text-[var(--text-muted)] truncate">
                      {orderCustomerName(order)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    ${(order.total || 0).toLocaleString()}
                  </p>
                  <p className="text-[0.5rem] text-[var(--text-muted)]">
                    {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="mt-3 text-center">
        <span className="text-[0.5rem] text-[var(--text-muted)]">
          Auto-refreshes every 30s
        </span>
      </div>
    </div>
  )
}
