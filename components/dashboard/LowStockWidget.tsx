import Link from 'next/link'
import { AlertTriangleIcon } from 'lucide-react'
import { getLowStockProducts } from '@/actions/products'

export async function LowStockWidget() {
  const items = await getLowStockProducts()
  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-600" />
          <h2 className="font-semibold text-amber-900">Low Stock Alert</h2>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
            {items.length}
          </span>
        </div>
        <Link href="/products?filter=low-stock" className="text-xs text-amber-700 font-medium hover:underline">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-50 border-b border-amber-100">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Product</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide hidden sm:table-cell">SKU</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Stock</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Min</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {items.slice(0, 8).map(p => (
              <tr key={p.id} className="hover:bg-amber-50/50">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                  {p.categories?.name && <p className="text-xs text-slate-400">{p.categories.name}</p>}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 hidden sm:table-cell">{p.sku}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-sm font-bold ${p.current_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.current_stock}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-sm text-slate-500">{p.low_stock_alert}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/stock-in/new?product_id=${p.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    Restock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 8 && (
          <div className="px-5 py-3 text-center">
            <Link href="/products?filter=low-stock" className="text-xs text-amber-700 hover:underline font-medium">
              +{items.length - 8} more low-stock items
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
