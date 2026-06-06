'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon, AlertTriangleIcon } from 'lucide-react'

export function LowStockWidgetClient({ children, count }: { children: ReactNode; count: number }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 hover:from-amber-100 hover:to-orange-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangleIcon className="size-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-amber-900 text-sm leading-tight">Low Stock Alert</h2>
            <p className="text-amber-700 text-xs">{count} items need attention</p>
          </div>
        </div>
        <ChevronDownIcon className={`size-4 text-amber-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && <>{children}</>}
    </div>
  )
}
