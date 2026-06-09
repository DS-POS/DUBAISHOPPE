'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, PackagePlus, ShoppingCart,
  FileText, Users, Tag, BarChart3, FileDown, Settings,
  ClipboardList, Truck, SlidersHorizontal, RotateCcw, ClipboardCheck, Receipt, ArrowLeftRight,
  LayoutGrid,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavItem { label: string; href: string; icon: React.ElementType; roles?: string[] }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Sale', href: '/billing', icon: ShoppingCart },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Quotations', href: '/quotations', icon: ClipboardList },
  { label: 'Product Inventory', href: '/products', icon: Package, roles: ['admin', 'manager'] },
  { label: 'Supplier Invoices', href: '/stock-in', icon: PackagePlus, roles: ['admin', 'manager'] },
  { label: 'Stock Adjustments', href: '/stock-adjustments', icon: SlidersHorizontal, roles: ['admin'] },
  { label: 'Returns', href: '/returns', icon: RotateCcw },
  { label: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardCheck, roles: ['admin'] },
  { label: 'Expenses', href: '/expenses', icon: Receipt, roles: ['admin'] },
  { label: 'Store Loans', href: '/store-loans', icon: ArrowLeftRight, roles: ['admin', 'manager'] },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Suppliers', href: '/suppliers', icon: Truck, roles: ['admin'] },
  { label: 'Labels', href: '/labels', icon: Tag, roles: ['admin', 'manager'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Tally Export', href: '/reports/tally', icon: FileDown, roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
]

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setMobileOpen(true)
    window.addEventListener('ds-open-sidebar', handler)
    return () => window.removeEventListener('ds-open-sidebar', handler)
  }, [])

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-[#111827] text-white border-r border-white/[0.05]">
        {/* Logo area — white section */}
        <div className="bg-white px-4 py-2 flex items-center justify-center border-b border-slate-100">
          <div className="w-16 overflow-hidden" style={{ clipPath: 'inset(0 0 26% 0)' }}>
            <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="w-16 object-contain object-top" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-xl px-3 py-2.5 flex items-center gap-3 text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-sm ring-1 ring-white/[0.08]'
                    : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'
                )}
              >
                <item.icon className={cn(
                  'w-4 h-4 flex-shrink-0 transition-all duration-200',
                  isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                )} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Customize Dashboard — only on /dashboard */}
        {pathname === '/dashboard' && (
          <div className="px-3 pb-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('ds-customize-dashboard'))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/[0.07] hover:text-slate-100 transition-all duration-200"
            >
              <LayoutGrid className="w-4 h-4 flex-shrink-0 text-slate-500" />
              <span className="truncate">Customize Dashboard</span>
            </button>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.05]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[11px] text-slate-600 font-medium">DS POS v1.0</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
              <span className="text-[10px] text-slate-600">Online</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 bottom-0 w-60 z-30">
        <SidebarContent />
      </div>

      {/* Hamburger hidden — BottomNav "More" button handles mobile sidebar */}

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed top-0 left-0 bottom-0 w-60 z-40">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
