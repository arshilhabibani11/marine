import type { ProductFormData } from '../../hooks/useProductForm'

interface ProductFormInventoryProps {
  form: ProductFormData
  updateField: <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => void
  getFieldClass: (field: string, extra?: string) => string
  labelClass: string
}

export function ProductFormInventory({ form, updateField, getFieldClass, labelClass }: ProductFormInventoryProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Inventory & Availability</h2>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.availability !== 'out-of-stock'}
            onChange={(e) => updateField('availability', e.target.checked ? 'in-stock' : 'out-of-stock')}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--success)]"
          />
          <span className="text-xs font-bold text-[var(--text-secondary)]">In Stock</span>
        </label>
        <p className="text-[0.625rem] text-[var(--text-muted)]">
          Unchecking marks the listing out of stock on the storefront (sets Availability to Out of Stock).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Stock Count</label>
          <input
            type="number"
            value={form.stockCount}
            onChange={(e) => updateField('stockCount', e.target.value)}
            min="0"
            className={`${getFieldClass('stockCount')} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Low Stock Threshold</label>
          <input
            type="number"
            value={form.lowStockThreshold}
            onChange={(e) => updateField('lowStockThreshold', e.target.value)}
            min="0"
            className={`${getFieldClass('lowStockThreshold')} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Availability</label>
          <select
            value={form.availability}
            onChange={(e) => updateField('availability', e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-gold)]"
          >
            <option value="in-stock">In Stock</option>
            <option value="sourced">Sourced on Request</option>
            <option value="emergency">Emergency Available</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Warehouse / Location</label>
          <input
            type="text"
            value={form.warehouseLocation}
            onChange={(e) => updateField('warehouseLocation', e.target.value)}
            placeholder="e.g. Dubai Hub, Rack A-12"
            className={getFieldClass('warehouseLocation')}
          />
        </div>
        <div>
          <label className={labelClass}>Lead Time</label>
          <input
            type="text"
            value={form.leadTime}
            onChange={(e) => updateField('leadTime', e.target.value)}
            placeholder="e.g. 2-3 business days"
            className={getFieldClass('leadTime')}
          />
        </div>
      </div>
    </div>
  )
}
