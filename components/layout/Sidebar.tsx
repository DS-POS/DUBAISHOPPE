'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, PackagePlus, ShoppingCart,
  FileText, Users, Tag, BarChart3, FileDown, Settings,
  ClipboardList, Truck, SlidersHorizontal, RotateCcw, ClipboardCheck, Receipt, ArrowLeftRight,
  LayoutGrid, Wrench,
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
  { label: 'Troubleshoot', href: '/troubleshoot', icon: Wrench, roles: ['admin'] },
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
      <div className="flex flex-col h-full text-white" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 60%, #0f172a 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Logo area */}
        <div className="px-3 py-2 flex items-center gap-2.5 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.97)' }}>
          <div className="w-11 overflow-hidden shrink-0" style={{ clipPath: 'inset(0 0 26% 0)' }}>
            <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="w-11 object-contain object-top" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-950 font-black text-xs leading-tight truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>Dubai Shoppe</p>
            <p className="text-slate-500 text-[9px] font-medium truncate">POS System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'relative rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 text-xs font-medium transition-all duration-200 group',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                )}
                style={isActive ? {
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(59,130,246,0.12) 100%)',
                  boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.25)',
                } : undefined}
              >
                {/* Active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-indigo-400" />
                )}
                <item.icon className={cn(
                  'w-4 h-4 flex-shrink-0 transition-all duration-200',
                  isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'
                )} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400/80 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Customize Dashboard — only on /dashboard */}
        {pathname === '/dashboard' && (
          <div className="px-2.5 pb-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('ds-customize-dashboard'))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-all duration-200"
            >
              <LayoutGrid className="w-4 h-4 flex-shrink-0 text-slate-500" />
              <span className="truncate">Customize Dashboard</span>
            </button>
          </div>
        )}

        {/* Bottom status */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.05]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[11px] text-slate-600 font-medium">DS POS v1.0</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-status-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
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
      <div className="hidden md:block fixed top-0 left-0 bottom-0 w-56 z-30">
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed top-0 left-0 bottom-0 w-60 z-40 animate-fade-in">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
