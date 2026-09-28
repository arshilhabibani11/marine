import { useRef } from 'react'
import { Upload, Plus, Trash2, GripVertical, Image, Loader2 } from 'lucide-react'
import { OptimizedImage } from '../ui/OptimizedImage'
import type { ProductFormData } from '../../hooks/useProductForm'

interface ProductFormImagesProps {
  form: ProductFormData
  updateImage: (i: number, field: string, value: string) => void
  addImage: () => void
  removeImage: (i: number) => void
  handleImageUpload: (file: File) => Promise<void>
  uploadingImage: boolean
  getFieldClass: (field: string, extra?: string) => string
  labelClass: string
  productImageInputId: string
}

export function ProductFormImages({
  form, updateImage, addImage, removeImage,
  handleImageUpload, uploadingImage,
  getFieldClass, labelClass, productImageInputId,
}: ProductFormImagesProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Product Images</h2>
        <button
          onClick={addImage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--accent-gold)] transition-colors"
        >
          <Plus size={12} /> Add Image
        </button>
      </div>

      <input
        ref={inputRef}
        id={productImageInputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files
          if (!files) return
          for (let i = 0; i < files.length; i++) {
            await handleImageUpload(files[i])
          }
          e.target.value = ''
        }}
      />
      <div
        className="rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center cursor-pointer hover:border-[var(--accent-gold)] transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[var(--accent-gold)]') }}
        onDragLeave={(e) => e.currentTarget.classList.remove('border-[var(--accent-gold)]')}
        onDrop={async (e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('border-[var(--accent-gold)]')
          const files = e.dataTransfer.files
          for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('image/')) await handleImageUpload(files[i])
          }
        }}
      >
        {uploadingImage ? (
          <><Loader2 size={32} className="mx-auto text-[var(--accent-gold)] animate-spin mb-3" /><p className="text-sm font-semibold text-[var(--text-secondary)]">Uploading...</p></>
        ) : (
          <><Upload size={32} className="mx-auto text-[var(--text-muted)] mb-3" /><p className="text-sm font-semibold text-[var(--text-secondary)]">Drag & drop images here, or click to upload</p><p className="text-xs text-[var(--text-muted)] mt-1">JPG, PNG, WebP, AVIF · Max 10MB · Recommended 800×800px</p></>
        )}
      </div>

      {form.images.map((img, i) => (
        <div key={i} className="flex items-start gap-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center pt-2 text-[var(--text-muted)]">
            <GripVertical size={14} />
          </div>
          <div className="h-20 w-20 shrink-0 rounded-lg bg-[var(--surface-soft)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
            {img.url ? (
              <OptimizedImage src={img.url} alt={img.alt} width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <Image size={20} className="text-[var(--text-muted)]" />
            )}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Image URL</label>
              <input
                type="text"
                value={img.url}
                onChange={(e) => updateImage(i, 'url', e.target.value)}
                placeholder="https://res.cloudinary.com/y7up4zti/image/upload/alka/products/product-001.jpg"
                className={getFieldClass('')}
              />
              <p className="mt-1 text-[0.625rem] text-[var(--text-muted)]">
                Full image URL only (https://…). Local paths like /images/… are retired and render broken.
              </p>
            </div>
            <div>
              <label className={labelClass}>Alt Text</label>
              <input
                type="text"
                value={img.alt}
                onChange={(e) => updateImage(i, 'alt', e.target.value)}
                placeholder="Product image description"
                className={getFieldClass('')}
              />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <select
                value={img.label}
                onChange={(e) => updateImage(i, 'label', e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-gold)]"
              >
                <option value="Main">Main</option>
                <option value="Side">Side View</option>
                <option value="Detail">Detail</option>
                <option value="Nameplate">Nameplate</option>
                <option value="Serial Plate">Serial Plate</option>
                <option value="Packaging">Packaging</option>
                <option value="Test Report">Test Report</option>
              </select>
            </div>
          </div>
          {form.images.length > 1 && (
            <button
              onClick={() => removeImage(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-danger/5 transition-colors mt-5"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
