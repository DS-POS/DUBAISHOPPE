'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, PackagePlus, ShoppingCart,
  FileText, Users, Tag, BarChart3, FileDown, Settings,
  ClipboardList, Menu, X
} from 'lucide-react'
import { useState } from 'react'

interface NavItem { label: string; href: string; icon: React.ElementType; adminOnly?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Sale', href: '/billing', icon: ShoppingCart },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Quotations', href: '/quotations', icon: ClipboardList },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Stock In', href: '/stock-in', icon: PackagePlus },
  { label: 'Customers', href: '/customers', icon: Users },
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
      <div className="flex flex-col h-full bg-[#0F172A] text-white">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="DS" className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{fontFamily:'Rubik,sans-serif'}}>DUBAI SHOPPE</p>
              <p className="text-[10px] text-slate-400">POS System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-[#0369A1] text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <p className="text-[10px] text-slate-500 text-center">DS POS v1.0</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block fixed top-0 left-0 bottom-0 w-60 z-30">
        <SidebarContent />
      </div>
      <button
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-[#0F172A] text-white rounded-lg flex items-center justify-center shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <div className="md:hidden fixed top-0 left-0 bottom-0 w-60 z-40">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
