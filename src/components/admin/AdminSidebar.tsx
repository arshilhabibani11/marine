import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Package,
  ImageIcon,
  FolderTree,
  Award,
  Factory,
  ShoppingCart,
  FileText,
  HandCoins,
  Users,
  Mail,
  Settings,
  Shield,
  ClipboardList,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { admin } from '../../lib/api'
import type { ApiDashboardStats } from '../../lib/api-types'

type BadgeConfig = {
  count?: number
  color: 'gold' | 'danger' | 'teal'
}

type NavItem =
  | { type: 'section'; section: string }
  | { type: 'nav'; to: string; label: string; icon: React.ReactNode; badge?: BadgeConfig }

const adminNavItems: NavItem[] = [
  { type: 'nav', to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { type: 'nav', to: '/admin/insights', label: 'Insights', icon: <BarChart3 size={18} /> },
  { type: 'section', section: 'Catalog' },
  { type: 'nav', to: '/admin/products', label: 'Products', icon: <Package size={18} /> },
  { type: 'nav', to: '/admin/media', label: 'Media Library', icon: <ImageIcon size={18} /> },
  { type: 'nav', to: '/admin/categories', label: 'Categories', icon: <FolderTree size={18} /> },
  { type: 'nav', to: '/admin/brands', label: 'Brands', icon: <Award size={18} /> },
  { type: 'nav', to: '/admin/industries', label: 'Industries', icon: <Factory size={18} /> },
  { type: 'section', section: 'Operations' },
  { type: 'nav', to: '/admin/orders', label: 'Orders', icon: <ShoppingCart size={18} /> },
  { type: 'nav', to: '/admin/rfqs', label: 'RFQs', icon: <FileText size={18} /> },
  { type: 'nav', to: '/admin/offers', label: 'Offers', icon: <HandCoins size={18} /> },
  { type: 'section', section: 'People' },
  { type: 'nav', to: '/admin/customers', label: 'Customers', icon: <Users size={18} /> },
  { type: 'nav', to: '/admin/messages', label: 'Messages', icon: <Mail size={18} /> },
  { type: 'section', section: 'Content' },
  { type: 'nav', to: '/admin/settings', label: 'Store Settings', icon: <Settings size={18} /> },
  { type: 'nav', to: '/admin/users', label: 'Users & Roles', icon: <Shield size={18} /> },
  { type: 'nav', to: '/admin/audit-log', label: 'Audit Log', icon: <ClipboardList size={18} /> },
]

export function AdminSidebar() {
  const { pathname } = useLocation()
  const collapsed = useStore((s) => s.adminSidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleAdminSidebar)
  const adminLogout = useStore((s) => s.adminLogout)
  const adminUser = useStore((s) => s.adminUser)

  // Dynamic notification counts from dashboard API
  const [badges, setBadges] = useState<Record<string, BadgeConfig>>({
    '/admin/orders': { count: 0, color: 'gold' },
    '/admin/rfqs': { count: 0, color: 'danger' },
    '/admin/messages': { count: 0, color: 'teal' },
  })

  useEffect(() => {
    let cancelled = false
    admin.dashboard.stats().then((stats: ApiDashboardStats) => {
      if (cancelled) return
      setBadges({
        '/admin/orders': { count: stats.pendingOrders || 0, color: 'gold' },
        // Count of unactioned (status 'new') RFQs. urgency is a separate axis,
        // so adding urgent/emergency double-counts the same records.
        '/admin/rfqs': { count: stats.newRfqs || 0, color: 'danger' },
        '/admin/messages': { count: stats.newMessages || 0, color: 'teal' },
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Role-based visibility — using actual role names from Prisma schema
  const ownerRoles = ['owner']
  const managerRoles = ['owner', 'store-manager', 'inventory-manager']
  // PUT /admin/settings requires store-manager — hide the page from roles that
  // could open it but always get 403 on Save.
  const settingsRoles = ['owner', 'store-manager']
  
  const canView = (path: string): boolean => {
    const role = adminUser?.role || 'owner'
    if (path === '/admin/users' || path === '/admin/audit-log') return ownerRoles.includes(role)
    if (path === '/admin/settings') return settingsRoles.includes(role)
    if (path === '/admin/media' || path === '/admin/categories' || path === '/admin/brands' || path === '/admin/industries') return managerRoles.includes(role)
    return true
  }

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 1024
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
    {/* Mobile overlay */}
    {isMobile && !collapsed && (
      <div
        className="admin-sidebar-overlay"
        onClick={toggleSidebar}
        onKeyDown={(e) => e.key === 'Escape' && toggleSidebar()}
        role="button"
        tabIndex={-1}
        aria-label="Close sidebar"
      />
    )}

    <aside
      className={`admin-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/8 transition-all duration-300 ${
        collapsed ? 'w-[68px] max-lg:-translate-x-full' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-gold)]">
          <span className="font-display text-sm font-extrabold text-[var(--btn-blue-text)]">AT</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-display text-sm font-bold text-white leading-tight">
              Alka Traders
            </span>
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white/60">
              Admin Panel
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="admin-scroll flex-1 overflow-y-auto px-3 py-3">
        {adminNavItems.map((item, i) => {
          if (item.type === 'section') {
            // Skip section if all following nav items are hidden
            return (
              <div key={`section-${i}`} className="nav-section-label">
                {collapsed ? '·' : item.section}
              </div>
            )
          }

          // Role-based hiding
          if (!canView(item.to)) return null

          const isActive =
            item.to === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.to)

          const badge = badges[item.to]

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item mb-0.5 ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {badge && badge.count && badge.count > 0 && (
                <span className={`nav-badge badge-${badge.color} ${collapsed ? '' : 'ml-auto'}`}>
                  {collapsed ? '' : badge.count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/8 px-3 py-3">
        <NavLink
          to="/"
          className="nav-item mb-1"
          title="View Storefront"
        >
          <span className="shrink-0">
            <ChevronLeft size={18} />
          </span>
          {!collapsed && <span>Back to Store</span>}
        </NavLink>

        <button
          onClick={adminLogout}
          className="nav-item mb-0.5 w-full text-left text-danger/70 hover:text-danger"
          title="Sign Out"
        >
          <span className="shrink-0">
            <LogOut size={18} />
          </span>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[var(--accent-blue)] text-[var(--btn-blue-text)] shadow-lg transition-colors hover:bg-[var(--accent-gold)] hover:text-[var(--btn-blue-text)]"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
    </>
  )
}
