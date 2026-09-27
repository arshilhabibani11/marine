import { Search, Calendar, X } from 'lucide-react'
import type { OrderStatus } from './types'
import { statusConfig } from './types'

interface OrderFiltersProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: OrderStatus | ''
  setStatusFilter: (v: OrderStatus | '') => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  setPage: (v: number) => void
  ordersCount: number
  statusCounts: Record<string, number>
}

export function OrderFilters({
  search, setSearch,
  statusFilter, setStatusFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  setPage,
  ordersCount, statusCounts,
}: OrderFiltersProps) {
  const hasActiveFilters = search.trim() || statusFilter || dateFrom || dateTo

  return (
    <>
      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setStatusFilter(''); setPage(1) }}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            statusFilter === ''
              ? 'bg-[var(--accent-gold)] text-[var(--btn-blue-text)] shadow-[0_4px_12px_rgba(232,170,36,0.2)]'
              : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
          }`}
        >
          All ({ordersCount})
        </button>
        {(Object.keys(statusConfig) as OrderStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status === statusFilter ? '' : status); setPage(1) }}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              statusFilter === status
                ? `${statusConfig[status].bg} ${statusConfig[status].color} border border-current/20`
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
            }`}
          >
            {statusConfig[status].label} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Search + Date Filters */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by order ID, customer, company, or SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--accent-gold)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              placeholder="From"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2.5 px-3 text-xs text-[var(--text-primary)] transition-all focus:border-[var(--accent-gold)]"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              placeholder="To"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2.5 px-3 text-xs text-[var(--text-primary)] transition-all focus:border-[var(--accent-gold)]"
            />
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--danger)]/10 px-2.5 py-2 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
              >
                <X size={10} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
