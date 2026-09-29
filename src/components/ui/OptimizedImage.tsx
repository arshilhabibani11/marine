interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  width?: number
  height?: number
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  sizes?: string
  optimized?: boolean
  /**
   * Width passed to the Cloudinary URL transform. Defaults to 800; set 0 to
   * disable the transform (e.g. og:image). Product-detail images pass a
   * larger width so uploaded photos render sharp at full column size —
   * previously uploaded (full-URL) images got NO transform and shipped
   * 2000px originals, while they were displayed small.
   */
  transformWidth?: number
}

import { applyImageFallback, applyCloudinaryTransform } from '../../lib/utils'

/**
 * OptimizedImage renders a clean, high-performance <img> element.
 * Bypasses fragile <picture> type negotiation that can break in browsers or edge-case header caching.
 *
 * On error: applies a graceful fallback chain directly on the DOM element
 * (avoids React state re-render flicker):
 *   Cloudinary product URL → local deployed copy → placeholder → stop.
 *
 * Any Cloudinary URL that doesn't already carry a width is sized here
 * (f_auto,q_auto,w_800,c_limit) — this is the single choke point that keeps
 * images built outside getProductImageUrl (e.g. the home category tiles, one
 * of which shipped a 269 KB original) from downloading at full resolution.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  loading = 'lazy',
  decoding = 'async',
  className,
  onError,
  transformWidth = 800,
  ...rest
}: OptimizedImageProps) {
  return (
    <img
      src={applyCloudinaryTransform(src, transformWidth)}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      className={className}
      onError={(e) => {
        applyImageFallback(e.currentTarget)
        if (onError) onError(e)
      }}
      {...rest}
    />
  )
}
