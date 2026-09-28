import { useState, useCallback, useRef } from 'react'
import { ZoomIn, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OptimizedImage } from '../ui/OptimizedImage'
import { getProductImageUrl, isLightColor } from '../../lib/utils'
import type { Product } from '../../types'

interface ProductImageGalleryProps {
  product: Product
}

export function ProductImageGallery({ product }: ProductImageGalleryProps) {
  const { t } = useTranslation()
  const [showZoom, setShowZoom] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 })
  const [showShare, setShowShare] = useState(false)

  // Touch zoom state
  const [touchScale, setTouchScale] = useState(1)
  const [touchOrigin, setTouchOrigin] = useState({ x: 50, y: 50 })
  const lastTouchDistance = useRef<number | null>(null)
  const lastTapTime = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Desktop: mouse hover zoom ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!showZoom) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomPos({ x, y })
  }, [showZoom])

  // ── Mobile: pinch-to-zoom ──
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const scaleDelta = distance / lastTouchDistance.current
      lastTouchDistance.current = distance

      setTouchScale((prev) => {
        const next = Math.min(Math.max(prev * scaleDelta, 1), 3)
        if (next <= 1) {
          setTouchOrigin({ x: 50, y: 50 })
        }
        return next
      })

      // Set zoom origin to midpoint of the two fingers
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width * 100
        const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height * 100
        setTouchOrigin({ x: midX, y: midY })
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null
  }, [])

  // ── Mobile: double-tap to zoom ──
  const handleDoubleTap = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now()
    if (now - lastTapTime.current < 300) {
      // Double tap detected
      if (touchScale > 1) {
        // Zoom out
        setTouchScale(1)
        setTouchOrigin({ x: 50, y: 50 })
      } else {
        // Zoom in to tap position
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const x = ((e.touches[0]?.clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width * 100
          const y = ((e.touches[0]?.clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height * 100
          setTouchOrigin({ x, y })
        }
        setTouchScale(2)
      }
    }
    lastTapTime.current = now
  }, [touchScale])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name || 'Alka Traders Product', url })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') navigator.clipboard?.writeText(url)
      }
    } else {
      navigator.clipboard?.writeText(url)
      setShowShare(true)
      setTimeout(() => setShowShare(false), 2000)
    }
  }

  const isZoomed = showZoom || touchScale > 1

  return (
    <>
      <div
        ref={containerRef}
        className="relative bg-[var(--secondary-bg)] border border-[var(--border)] p-4 rounded-2xl overflow-hidden group cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setShowZoom(true)}
        onMouseLeave={() => setShowZoom(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="overflow-hidden rounded-xl bg-[var(--primary-bg)] aspect-square max-h-[450px] flex items-center justify-center relative"
          onTouchEnd={handleDoubleTap}
        >
          <OptimizedImage
            src={getProductImageUrl(product.filename, 1200)}
            alt={product.name}
            width={600}
            height={600}
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, 55vw"
            className={`w-full h-full object-contain p-2 transition-transform duration-200 ${
              showZoom ? 'scale-150' : touchScale > 1 ? '' : 'scale-100'
            }`}
            style={{
              transform: showZoom
                ? `scale(1.5)`
                : touchScale > 1
                ? `scale(${touchScale})`
                : undefined,
              transformOrigin: showZoom
                ? `${zoomPos.x}% ${zoomPos.y}%`
                : `${touchOrigin.x}% ${touchOrigin.y}%`,
            }}
          />
          {/* Desktop zoom hint */}
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-xs text-white px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 opacity-0 group-hover:opacity-80 transition-opacity max-sm:hidden">
            <ZoomIn size={12} /> {t('product.hoverToZoom')}
          </div>
          {/* Mobile zoom hint — shows briefly on first touch */}
          {touchScale <= 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-xs text-white px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 sm:hidden pointer-events-none">
              <ZoomIn size={12} /> Pinch or double-tap to zoom
            </div>
          )}
          {/* Zoom indicator when zoomed */}
          {isZoomed && (
            <button
              onClick={() => {
                setShowZoom(false)
                setTouchScale(1)
                setTouchOrigin({ x: 50, y: 50 })
              }}
              className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-sm text-xs text-white px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5"
            >
              {Math.round(showZoom ? 150 : touchScale * 100)}% — tap to reset
            </button>
          )}
          {product.customLabel && (
            <span
              className="absolute top-3 left-3 z-10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg shadow-lg"
              style={{
                backgroundColor: product.customLabelColor || '#159a67',
                color: isLightColor(product.customLabelColor || '#159a67') ? '#1a1a1a' : '#ffffff',
              }}
            >
              {product.customLabel}
            </span>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <span className="text-white font-bold text-lg bg-black/70 px-6 py-3 rounded-xl">{t('product.outOfStock')}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleShare}
          className="absolute top-6 right-6 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2 hover:border-[var(--accent-gold)] transition-colors"
          aria-label={t('product.ariaShare')}
        >
          <Share2 size={16} className="text-[var(--text-secondary)]" />
        </button>
      </div>
      {showShare && (
        <div className="mt-2 bg-[var(--success)] text-[var(--btn-success-text)] text-xs font-bold px-4 py-2 rounded-lg inline-block">
          {t('product.linkCopied')}
        </div>
      )}
    </>
  )
}
