'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, PackagePlus, ShoppingCart,
  FileText, Users, Tag, BarChart3, FileDown, Settings,
  ClipboardList, Menu, X, Truck, SlidersHorizontal, RotateCcw, ClipboardCheck, Receipt, ArrowLeftRight
} from 'lucide-react'
import { useState } from 'react'

interface NavItem { label: string; href: string; icon: React.ElementType; adminOnly?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Sale', href: '/billing', icon: ShoppingCart },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Quotations', href: '/quotations', icon: ClipboardList },
  { label: 'Product Inventory', href: '/products', icon: Package },
  { label: 'Supplier Invoices', href: '/stock-in', icon: PackagePlus },
  { label: 'Stock Adjustments', href: '/stock-adjustments', icon: SlidersHorizontal },
  { label: 'Returns', href: '/returns', icon: RotateCcw },
  { label: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardCheck },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Store Loans', href: '/store-loans', icon: ArrowLeftRight },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Suppliers', href: '/suppliers', icon: Truck },
  { label: 'Labels', href: '/labels', icon: Tag },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Tally Export', href: '/reports/tally', icon: FileDown, adminOnly: true },
  { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = userRole === 'admin'

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-[#111827] text-white border-r border-white/[0.05]">
        {/* Logo area */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              <img src="/DUBAI LOGO BR.png" alt="DS" className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate tracking-wide text-white">DUBAI SHOPPE</p>
              <p className="text-[10px] text-slate-500 mt-0.5">POS System</p>
            </div>
          </div>
        </div>

        {/* Gradient divider */}
        <div className="mx-4 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(item => {
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

      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center shadow-lg ring-1 ring-white/10 transition-all duration-150 hover:bg-[#1F2937]"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

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
