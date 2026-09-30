import type { ProductFormData } from '../../hooks/useProductForm'

interface ProductFormSeoProps {
  form: ProductFormData
  updateField: <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => void
  getFieldClass: (field: string, extra?: string) => string
  labelClass: string
}

const UNKNOWN_HINT = 'Leave blank if unknown — never guess'

export function ProductFormSeo({ form, updateField, getFieldClass, labelClass }: ProductFormSeoProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Product Identity</h2>
      <p className="text-xs text-[var(--text-muted)] -mt-3">
        Verified identifiers from manufacturer documentation. These feed Google
        (structured data + Merchant Center), so accuracy matters more than
        completeness — an empty field is always better than a guessed one.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Manufacturer</label>
          <input
            type="text"
            value={form.manufacturer}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            placeholder="e.g. TERYair"
            className={getFieldClass('manufacturer')}
          />
        </div>
        <div>
          <label className={labelClass}>Model Number</label>
          <input
            type="text"
            value={form.modelNumber}
            onChange={(e) => updateField('modelNumber', e.target.value)}
            placeholder="e.g. 23-24-83 PB"
            className={getFieldClass('modelNumber')}
          />
        </div>
        <div>
          <label className={labelClass}>MPN (Manufacturer Part Number)</label>
          <input
            type="text"
            value={form.mpn}
            onChange={(e) => updateField('mpn', e.target.value)}
            placeholder={UNKNOWN_HINT}
            className={getFieldClass('mpn')}
          />
        </div>
        <div>
          <label className={labelClass}>GTIN (Barcode)</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.gtin}
            onChange={(e) => updateField('gtin', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="8, 12, 13 or 14 digits — only from real packaging"
            className={getFieldClass('gtin')}
          />
          {form.gtin && !/^(\d{8}|\d{12,14})$/.test(form.gtin) && (
            <p className="mt-1 text-[0.625rem] text-[var(--danger)]">
              GTIN must be 8 or 12–14 digits. Never enter an IMPA code or internal SKU here.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>IMPA Code</label>
          <input
            type="text"
            value={form.impaCode}
            onChange={(e) => updateField('impaCode', e.target.value)}
            placeholder="e.g. 232483"
            className={getFieldClass('impaCode')}
          />
        </div>
        <div>
          <label className={labelClass}>Source URL (documentation)</label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => updateField('sourceUrl', e.target.value)}
            placeholder="Manufacturer page or datasheet URL used to verify"
            className={getFieldClass('sourceUrl')}
          />
        </div>
      </div>

      <h2 className="font-display text-lg font-bold text-[var(--text-primary)] pt-2">SEO &amp; Search</h2>

      <div>
        <label className={labelClass}>Meta Title</label>
        <input
          type="text"
          value={form.seoTitle}
          onChange={(e) => updateField('seoTitle', e.target.value)}
          placeholder="SEO title (auto-filled from product name)"
          className={getFieldClass('seoTitle')}
        />
        <p className="mt-1 text-[0.625rem] text-[var(--text-muted)]">
          {form.seoTitle.length}/60 characters · {form.seoTitle.length > 60 ? 'Too long' : 'Good'}
        </p>
      </div>

      <div>
        <label className={labelClass}>Meta Description</label>
        <textarea
          value={form.seoDescription}
          onChange={(e) => updateField('seoDescription', e.target.value)}
          placeholder="SEO description for search results"
          rows={3}
          className={`${getFieldClass('seoDescription')} resize-y`}
        />
        <p className="mt-1 text-[0.625rem] text-[var(--text-muted)]">
          {form.seoDescription.length}/160 characters · {form.seoDescription.length > 160 ? 'Too long' : 'Good'}
        </p>
      </div>

      <div>
        <label className={labelClass}>Search Keywords</label>
        <textarea
          value={form.searchKeywords}
          onChange={(e) => updateField('searchKeywords', e.target.value)}
          placeholder="Additional search keywords, part numbers, alternate names (comma-separated)"
          rows={2}
          className={`${getFieldClass('searchKeywords')} resize-y`}
        />
      </div>
    </div>
  )
}
