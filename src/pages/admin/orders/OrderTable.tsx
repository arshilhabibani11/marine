import { Package, Eye, Loader2 } from 'lucide-react'
import type { Order } from './types'
import { statusConfig, formatDate } from './types'
import { AdminPagination } from '../../../components/admin/AdminPagination'

interface OrderTableProps {
  loading: boolean
  paginatedOrders: Order[]
  setSelectedOrder: (order: Order) => void
  page: number
  totalPages: number
  setPage: (page: number) => void
}

export function OrderTable({ loading, paginatedOrders, setSelectedOrder, page, totalPages, setPage }: OrderTableProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--accent-gold)]" />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading orders...</span>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Date</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <Package size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--text-muted)]">No orders found</p>
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => {
                const Icon = statusConfig[order.status].icon
                return (
                  <tr
                    key={order.id}
                    className="cursor-pointer hover:bg-[var(--surface-soft)]"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="font-mono text-xs font-bold text-[var(--accent-blue)]">{order.orderNumber}</td>
                    <td>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{order.company}</p>
                        <p className="text-[0.625rem] text-[var(--text-muted)]">{order.country}</p>
                      </div>
                    </td>
                    <td className="text-xs">{order.items.length} items</td>
                    <td className="font-mono text-xs font-bold">${order.total.toLocaleString()}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-bold ${statusConfig[order.status].bg} ${statusConfig[order.status].color}`}>
                        <Icon size={10} />
                        {statusConfig[order.status].label}
                      </span>
                    </td>
                    <td>
                      <span className={`text-[0.625rem] font-bold ${
                        order.paymentStatus === 'paid' ? 'text-[var(--success)]' :
                        order.paymentStatus === 'refunded' ? 'text-[var(--danger)]' :
                        'text-[var(--accent-gold)]'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{formatDate(order.createdAt)}</td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order) }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--gold-muted)] transition-colors"
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
