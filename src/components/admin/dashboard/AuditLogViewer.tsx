import { useState, useEffect, useCallback } from 'react'
import { History, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { admin } from '../../../lib/api'
import { useStore } from '../../../store/useStore'


interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityName: string
  actorEmail: string
  createdAt: string
  details?: string
}

export function AuditLogViewer() {
  // /admin/audit is owner-only (routes/admin/audit.ts + AdminSidebar), so the
  // widget is hidden for every other role instead of silently 403-ing.
  const isOwner = useStore((s) => s.adminUser?.role === 'owner')
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchLogs = useCallback(async () => {
    if (!isOwner) return
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (search) params.search = search
      if (entityFilter) params.entityType = entityFilter
      const res = await admin.audit.list(params)
      setLogs((res.logs || []) as unknown as AuditEntry[])
      setTotalPages(res.pagination?.totalPages || 1)
    } catch {
      console.warn('[AuditLogViewer] Failed to fetch audit logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, search, entityFilter, isOwner])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (!isOwner) return null

  const actionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-[var(--success)]'
    if (action.includes('delete') || action.includes('remove')) return 'text-[var(--danger)]'
    if (action.includes('update') || action.includes('edit')) return 'text-[var(--accent-blue)]'
    return 'text-[var(--text-muted)]'
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-[var(--accent-gold)]" />
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Audit Log</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search audit logs..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-gold)]" />
        </div>
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-primary)]">
          <option value="">All entities</option>
          <option value="product">Products</option>
          <option value="order">Orders</option>
          <option value="rfq">RFQs</option>
          <option value="offer">Offers</option>
          <option value="customer">Customers</option>
          <option value="store_settings">Settings</option>
        </select>
      </div>

      {/* Log entries */}
      <div className="space-y-1.5">
        {loading ? (
          <p className="text-center text-xs text-[var(--text-muted)] py-8">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-xs text-[var(--text-muted)] py-8">No audit logs found</p>
        ) : (
          logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
              <span className={`font-mono text-[0.625rem] font-bold uppercase ${actionColor(log.action)} shrink-0`}>
                {log.action}
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {log.entityName || log.entityType}
              </span>
              <span className="text-[0.625rem] text-[var(--text-muted)] shrink-0">
                by {log.actorEmail}
              </span>
              <span className="ml-auto text-[0.625rem] text-[var(--text-muted)] whitespace-nowrap shrink-0">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-[var(--text-muted)]">Page {page} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
