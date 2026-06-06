import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { getLowStockProducts } from '@/actions/products'
import { LowStockWidgetClient } from './LowStockWidgetClient'

export async function LowStockWidget() {
  const items = await getLowStockProducts()
  if (items.length === 0) return null

  const outOfStock = items.filter(p => p.current_stock === 0).length
  const lowCount = items.length - outOfStock

  return (
    <LowStockWidgetClient count={items.length}>
      {/* Stats Row */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
        <div className="px-3 py-2 text-center">
          <p className="text-lg font-black text-red-500">{outOfStock}</p>
          <p className="text-xs text-slate-500 font-medium">Out of Stock</p>
        </div>
        <div className="px-3 py-2 text-center">
          <p className="text-lg font-black text-amber-500">{lowCount}</p>
          <p className="text-xs text-slate-500 font-medium">Running Low</p>
        </div>
      </div>

      {/* Top 3 Preview */}
      <div className="px-4 py-2.5 space-y-2">
        {items.slice(0, 3).map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
              {p.categories?.name && (
                <p className="text-xs text-slate-400 truncate">{p.categories.name}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
              p.current_stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {p.current_stock === 0 ? 'Out' : `${p.current_stock} left`}
            </span>
          </div>
        ))}
        {items.length > 3 && (
          <p className="text-xs text-slate-400 text-center">+{items.length - 3} more</p>
        )}
      </div>

      {/* CTA Button */}
      <div className="px-4 pb-3 pt-1">
        <Link
          href="/products?filter=low-stock"
          className="flex items-center justify-center gap-2 w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 rounded-xl transition-colors text-xs"
        >
          View All
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </LowStockWidgetClient>
  )
}
