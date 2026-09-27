import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  HandCoins,
  Eye,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  Building,
  Calendar,
  Mail,
  User,
  Download,
  ShoppingCart,
  Loader2,
  Tag,
} from 'lucide-react'
import { admin } from '../../lib/api'
import { downloadCsv } from '../../lib/utils'
import { useToast } from '../../components/admin/toast-context'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { AdminPagination } from '../../components/admin/AdminPagination'
import type { ApiOffer } from '../../lib/api-types'

// Mirrors backend Offer.status values (offerAdminService.ts + rfqService.ts):
// pending → accept/reject/counter → accepted → convert-to-order.
type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'converted-to-order'

const OFFER_STATUSES: OfferStatus[] = ['pending', 'countered', 'accepted', 'rejected', 'converted-to-order']

interface Offer {
  /** Backend UUID — use this for every API call. */
  id: string
  /** Human-facing offer number. */
  number: string
  rfqNumber: string
  customerName: string
  customerEmail: string
  customerCompany: string
  customerCountry: string
  productName: string
  productSku: string
  quantity: number
  offeredPrice: number
  counterPrice: number | null
  /** counterPrice when present, otherwise the customer's offered price. */
  unitPrice: number
  total: number
  status: OfferStatus
  message: string
  adminNotes: string
  expiresAt: string
  respondedAt: string
  createdAt: string
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapApiOffer(o: ApiOffer): Offer {
  const quantity = o.quantity ?? 1
  const offeredPrice = toNumber(o.offeredPrice)
  const counterPrice = o.counterPrice != null ? toNumber(o.counterPrice) : null
  const unitPrice = counterPrice ?? offeredPrice
  return {
    id: o.id,
    number: o.offerNumber || o.id,
    rfqNumber: o.rfqNumber || o.rfqId || '',
    customerName: o.customer?.name || '',
    customerEmail: o.customerEmail || '',
    customerCompany: o.customer?.company || '',
    customerCountry: o.customer?.country || '',
    productName: o.product?.name || 'Unknown Product',
    productSku: o.product?.sku || '',
    quantity,
    offeredPrice,
    counterPrice,
    unitPrice,
    total: unitPrice * quantity,
    status: (o.status || 'pending') as OfferStatus,
    message: o.message || '',
    adminNotes: o.adminNotes || '',
    expiresAt: o.expiresAt?.split('T')[0] || '',
    respondedAt: o.respondedAt?.split('T')[0] || '',
    createdAt: o.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
  }
}

interface StatusCfg {
  label: string
  color: string
  bg: string
  icon: typeof Clock
}

const statusConfig: Record<string, StatusCfg> = {
  pending: { label: 'Pending', color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10', icon: Clock },
  countered: { label: 'Countered', color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', icon: HandCoins },
  accepted: { label: 'Accepted', color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10', icon: XCircle },
  'converted-to-order': { label: 'Converted to Order', color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10', icon: ShoppingCart },
}

const fallbackStatus: StatusCfg = { label: 'Unknown', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--text-muted)]/10', icon: AlertTriangle }

// Never crash on an unexpected status value coming back from the API.
function statusOf(status: string): StatusCfg {
  return statusConfig[status] ?? fallbackStatus
}

const ITEMS_PER_PAGE = 12

export default function AdminOffers() {
  const { toast } = useToast()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OfferStatus | ''>('')
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [page, setPage] = useState(1)
  const [serverTotal, setServerTotal] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [convertingOffer, setConvertingOffer] = useState<string | null>(null)
  const [counterTarget, setCounterTarget] = useState<Offer | null>(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterSaving, setCounterSaving] = useState(false)

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search.trim()) params.search = search.trim()
      if (statusFilter) params.status = statusFilter
      params.page = String(page)
      params.limit = String(ITEMS_PER_PAGE)
      const res = await admin.offers.list(params)
      setOffers((res.offers || []).map(mapApiOffer))
      setServerTotal(res.pagination?.total ?? 0)
    } catch (err: unknown) {
      console.error('Failed to load offers:', err)
      toast('Failed to load offers', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page, toast])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  // Keep the open detail slide-over in sync with the refreshed list after a
  // mutation (accept/reject/convert/counter) so it never shows stale fields.
  useEffect(() => {
    setSelectedOffer((prev) => {
      if (!prev) return prev
      return offers.find((o) => o.id === prev.id) ?? null
    })
  }, [offers])

  const filtered = useMemo(() => {
    let result = [...offers]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((o) =>
        o.number.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerCompany.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.productSku.toLowerCase().includes(q) ||
        o.rfqNumber.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter((o) => o.status === statusFilter)
    return result
  }, [offers, search, statusFilter])

  // Server paginates/filters; the client pass only refines within the page.
  const totalPages = Math.max(1, Math.ceil(serverTotal / ITEMS_PER_PAGE))
  const paginated = filtered.slice(0, ITEMS_PER_PAGE)

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    offers.forEach((o) => counts.set(o.status, (counts.get(o.status) || 0) + 1))
    return counts
  }, [offers])

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

  const offerNumber = (id: string) => offers.find((o) => o.id === id)?.number || id

  const handleAccept = async (offerId: string) => {
    try {
      await admin.offers.accept(offerId)
      toast(`Offer ${offerNumber(offerId)} accepted`, 'success')
      fetchOffers()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to accept offer', 'error')
    }
  }

  const handleReject = async (offerId: string) => {
    try {
      await admin.offers.reject(offerId)
      toast(`Offer ${offerNumber(offerId)} rejected`, 'info')
      fetchOffers()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to reject offer', 'error')
    }
  }

  const handleCounter = async () => {
    if (!counterTarget) return
    const price = Number(counterPrice)
    if (!Number.isFinite(price) || price <= 0) {
      toast('Enter a valid counter price', 'error')
      return
    }
    setCounterSaving(true)
    try {
      await admin.offers.counter(counterTarget.id, price)
      toast(`Counter sent for ${counterTarget.number}`, 'success')
      setCounterTarget(null)
      setCounterPrice('')
      fetchOffers()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to send counter offer', 'error')
    } finally {
      setCounterSaving(false)
    }
  }

  const handleConvertToOrder = async (offerId: string) => {
    setConvertingOffer(offerId)
    try {
      const result = await admin.offers.convertToOrder(offerId)
      toast(`Order ${result.order?.orderNumber || ''} created from offer`, 'success')
      fetchOffers()
      setSelectedOffer(null)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to convert offer to order', 'error')
    } finally {
      setConvertingOffer(null)
    }
  }

  const [exporting, setExporting] = useState(false)

  // Exports the full offer dataset from the server (not just the current page).
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const csv = await admin.offers.exportCsv()
      downloadCsv(csv, `offers-export-${new Date().toISOString().split('T')[0]}.csv`)
      toast('Offers exported to CSV', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const renderStatusBadge = (status: string) => {
    const cfg = statusOf(status)
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-bold ${cfg.bg} ${cfg.color}`}>
        <Icon size={10} /> {cfg.label}
      </span>
    )
  }

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text-primary)]">Offers</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{serverTotal} offer{serverTotal === 1 ? '' : 's'}</p>
        </div>
        <button onClick={handleExportCsv} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--accent-teal)] hover:text-[var(--accent-teal)] disabled:opacity-50">
          <Download size={14} /> {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => { setStatusFilter(''); setPage(1) }} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${statusFilter === '' ? 'bg-[var(--accent-gold)] text-[var(--btn-blue-text)] shadow-[0_4px_12px_rgba(232,170,36,0.2)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'}`}>
          All ({serverTotal})
        </button>
        {OFFER_STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1) }} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${statusFilter === s ? `${statusConfig[s].bg} ${statusConfig[s].color} border border-current/20` : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'}`}>
            {statusConfig[s].label} ({statusCounts.get(s) || 0})
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" placeholder="Search by offer number, customer, product, SKU, or RFQ..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--accent-gold)]" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
                <th>Status</th>
                <th>Expires</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 size={20} className="animate-spin text-[var(--accent-gold)] mx-auto" /></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12"><HandCoins size={32} className="mx-auto text-[var(--text-muted)] mb-3" /><p className="text-sm font-semibold text-[var(--text-muted)]">No offers found</p></td></tr>
              ) : paginated.map((offer) => (
                <tr key={offer.id} className="cursor-pointer hover:bg-[var(--surface-soft)]" onClick={() => setSelectedOffer(offer)}>
                  <td>
                    <p className="font-mono text-xs font-bold text-[var(--accent-blue)]">{offer.number}</p>
                    {offer.rfqNumber && <p className="text-[0.625rem] text-[var(--text-muted)]">RFQ: {offer.rfqNumber}</p>}
                  </td>
                  <td>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{offer.customerName || offer.customerEmail}</p>
                      <p className="text-[0.625rem] text-[var(--text-muted)]">{offer.customerCompany || offer.customerEmail}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] truncate max-w-[180px]">{offer.productName}</p>
                      {offer.productSku && <p className="text-[0.625rem] text-[var(--text-muted)] font-mono">{offer.productSku}</p>}
                    </div>
                  </td>
                  <td className="text-xs font-bold">{offer.quantity}</td>
                  <td className="font-mono text-xs font-bold">
                    {offer.counterPrice != null ? (
                      <>
                        <span className="text-[var(--accent-blue)]">${offer.counterPrice.toLocaleString()}</span>
                        <span className="ml-1 line-through text-[var(--text-muted)]">${offer.offeredPrice.toLocaleString()}</span>
                      </>
                    ) : (
                      <span>${offer.offeredPrice.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="font-mono text-xs font-bold text-[var(--text-primary)]">${offer.total.toLocaleString()}</td>
                  <td>{renderStatusBadge(offer.status)}</td>
                  <td className="text-xs text-[var(--text-muted)]">{offer.expiresAt ? formatDate(offer.expiresAt) : '—'}</td>
                  <td>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedOffer(offer) }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--gold-muted)] transition-colors">
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {selectedOffer && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOffer(null)}>
          <div className="relative w-full max-w-xl max-md:max-w-full max-md:rounded-none bg-[var(--surface)] shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">{selectedOffer.number}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedOffer.productName}{selectedOffer.rfqNumber ? ` · RFQ ${selectedOffer.rfqNumber}` : ''}</p>
              </div>
              <button onClick={() => setSelectedOffer(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)] transition-colors"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                {renderStatusBadge(selectedOffer.status)}
                {selectedOffer.rfqNumber && <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><Tag size={12} /> RFQ: {selectedOffer.rfqNumber}</span>}
              </div>

              {(selectedOffer.status === 'pending' || selectedOffer.status === 'countered') && (
                <div className="rounded-xl border border-[var(--accent-gold)]/20 bg-[var(--accent-gold)]/5 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Offer Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleAccept(selectedOffer.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/10 px-3 py-2 text-xs font-bold text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors">
                      <CheckCircle size={12} /> Accept Offer
                    </button>
                    <button onClick={() => { setCounterTarget(selectedOffer); setCounterPrice(selectedOffer.counterPrice != null ? String(selectedOffer.counterPrice) : '') }} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-3 py-2 text-xs font-bold text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 transition-colors">
                      <HandCoins size={12} /> Counter Offer
                    </button>
                    <button onClick={() => setRejectTarget(selectedOffer.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3 py-2 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors">
                      <XCircle size={12} /> Reject Offer
                    </button>
                  </div>
                </div>
              )}

              {selectedOffer.status === 'accepted' && (
                <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success)]/5 p-4 space-y-3">
                  <div className="text-center">
                    <CheckCircle size={20} className="mx-auto text-[var(--success)] mb-1" />
                    <p className="text-xs font-bold text-[var(--success)]">Offer Accepted — ready to process</p>
                  </div>
                  <button onClick={() => handleConvertToOrder(selectedOffer.id)} disabled={convertingOffer === selectedOffer.id} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--success)] px-4 py-2.5 text-xs font-bold text-[var(--btn-success-text)] hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50">
                    {convertingOffer === selectedOffer.id ? <><Loader2 size={12} className="animate-spin" /> Converting...</> : <><ShoppingCart size={12} /> Convert to Order</>}
                  </button>
                </div>
              )}

              {selectedOffer.status === 'rejected' && (
                <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4 text-center">
                  <XCircle size={20} className="mx-auto text-[var(--danger)] mb-1" />
                  <p className="text-xs font-bold text-[var(--danger)]">Offer Rejected</p>
                </div>
              )}

              {selectedOffer.status === 'converted-to-order' && (
                <div className="rounded-xl border border-[var(--accent-teal)]/20 bg-[var(--accent-teal)]/5 p-4 text-center">
                  <ShoppingCart size={20} className="mx-auto text-[var(--accent-teal)] mb-1" />
                  <p className="text-xs font-bold text-[var(--accent-teal)]">Converted to an order</p>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Customer</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2"><User size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">{selectedOffer.customerName || '—'}</span></div>
                  <div className="flex items-center gap-2"><Mail size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">{selectedOffer.customerEmail || '—'}</span></div>
                  <div className="flex items-center gap-2"><Building size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">{selectedOffer.customerCompany || '—'}</span></div>
                  <div className="flex items-center gap-2"><MapPin size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">{selectedOffer.customerCountry || '—'}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Pricing</h3>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Product</span><span className="text-[var(--text-secondary)] truncate max-w-[60%]">{selectedOffer.productName}</span></div>
                  {selectedOffer.productSku && <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">SKU</span><span className="font-mono text-[var(--text-secondary)]">{selectedOffer.productSku}</span></div>}
                  <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Offered unit price</span><span className="font-mono font-bold">${selectedOffer.offeredPrice.toLocaleString()}</span></div>
                  {selectedOffer.counterPrice != null && (
                    <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Counter price</span><span className="font-mono font-bold text-[var(--accent-blue)]">${selectedOffer.counterPrice.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Quantity</span><span className="font-mono font-bold">{selectedOffer.quantity}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-[var(--border)]"><span>Total</span><span className="font-mono text-[var(--accent-gold)]">${selectedOffer.total.toLocaleString()}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Timeline</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2"><Calendar size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">Created: {formatDate(selectedOffer.createdAt)}</span></div>
                  <div className="flex items-center gap-2"><Clock size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">Expires: {selectedOffer.expiresAt ? formatDate(selectedOffer.expiresAt) : '—'}</span></div>
                  {selectedOffer.respondedAt && (
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-secondary)]">Responded: {formatDate(selectedOffer.respondedAt)}</span></div>
                  )}
                </div>
              </div>

              {selectedOffer.message && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Customer Message</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedOffer.message}</p>
                </div>
              )}

              {selectedOffer.adminNotes && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Admin Notes</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedOffer.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Counter Offer Modal */}
      {counterTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setCounterTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">Counter Offer</h3>
              <button onClick={() => setCounterTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{counterTarget.number} · customer offered ${counterTarget.offeredPrice.toLocaleString()} × {counterTarget.quantity}</p>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Counter Unit Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                placeholder="0.00"
                aria-label="Counter price"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] py-2.5 px-4 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent-gold)]"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setCounterTarget(null)} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition-colors">Cancel</button>
              <button onClick={handleCounter} disabled={counterSaving} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-gold)] px-4 py-2.5 text-xs font-extrabold text-[var(--btn-blue-text)] transition-all hover:brightness-95 disabled:opacity-50">
                {counterSaving ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />}
                {counterSaving ? 'Sending...' : 'Send Counter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    <ConfirmDialog
      open={!!rejectTarget}
      title="Reject Offer"
      message="Are you sure you want to reject this offer? The customer will be notified."
      confirmLabel="Reject"
      danger
      onConfirm={() => { if (rejectTarget) handleReject(rejectTarget); setRejectTarget(null) }}
      onCancel={() => setRejectTarget(null)}
    />
    </>
  )
}
