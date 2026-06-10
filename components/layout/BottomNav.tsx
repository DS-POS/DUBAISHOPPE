'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, FileText, Package, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Sale', href: '/billing', icon: ShoppingCart },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Products', href: '/products', icon: Package },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14">
        {tabs.map(tab => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/dashboard' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:bg-slate-50',
                isActive ? 'text-slate-900' : 'text-slate-400'
              )}
            >
              <tab.icon
                className={cn(
                  'w-5 h-5',
                  isActive ? 'text-slate-900' : 'text-slate-400'
                )}
              />
              {tab.label}
            </Link>
          )
        })}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('ds-open-sidebar'))}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-400 active:bg-slate-50"
        >
          <Menu className="w-5 h-5 text-slate-400" />
          More
        </button>
      </div>
    </nav>
  )
}
