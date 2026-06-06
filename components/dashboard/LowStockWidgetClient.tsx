'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon, AlertTriangleIcon } from 'lucide-react'

export function LowStockWidgetClient({ children, count }: { children: ReactNode; count: number }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <AlertTriangleIcon className="size-4 text-white" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-white text-sm leading-tight">Low Stock</h2>
            <p className="text-red-100 text-xs">{count} items</p>
          </div>
        </div>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}>
          {isOpen ? '▾' : '▸'}
        </span>
      </button>
      {isOpen && <>{children}</>}
    </div>
  )
}
