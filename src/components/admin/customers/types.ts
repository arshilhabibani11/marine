export type CustomerStatus = 'active' | 'inactive' | 'vip' | 'new'

export type CustomerOrderStatus =
  | 'pending' | 'confirmed' | 'paid' | 'processing' | 'packed'
  | 'shipped' | 'delivered' | 'cancelled'

export interface CustomerOrder {
  id: string
  date: string
  total: number
  status: CustomerOrderStatus
  itemCount: number
}

export interface CustomerType {
  id: string
  name: string
  email: string
  phone: string
  company: string
  country: string
  city: string
  address: string
  website: string
  status: CustomerStatus
  joinedDate: string
  lastOrderDate: string
  totalOrders: number
  totalSpent: number
  avgOrderValue: number
  orders: CustomerOrder[]
  tags: string[]
  notes: string
}

export const statusConfig: Record<CustomerStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10' },
  inactive: { label: 'Inactive', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--text-muted)]/10' },
  vip: { label: 'VIP', color: 'text-[var(--accent-gold)]', bg: 'bg-[var(--accent-gold)]/10' },
  new: { label: 'New', color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
}
