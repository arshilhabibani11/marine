import { useTranslation } from 'react-i18next'
import { RefreshCw, WifiOff } from 'lucide-react'

interface CatalogOfflineNoticeProps {
  /** Called when the user asks to retry the failed catalog request. */
  onRetry?: () => void
  /** True while a retry is in flight (disables the button + spins the icon). */
  retrying?: boolean
  className?: string
}

/**
 * Surfaced whenever a catalog API query fails, so an outage reads as
 * "catalog unavailable" instead of silently showing demo/stale products.
 */
export function CatalogOfflineNotice({ onRetry, retrying = false, className = '' }: CatalogOfflineNoticeProps) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 ${className}`}
    >
      <WifiOff size={16} className="shrink-0 text-[var(--danger)]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--text-primary)]">{t('catalog.offlineTitle')}</p>
        <p className="text-xs text-[var(--text-secondary)]">{t('catalog.offlineBody')}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--danger)] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
          {t('catalog.retry')}
        </button>
      )}
    </div>
  )
}
