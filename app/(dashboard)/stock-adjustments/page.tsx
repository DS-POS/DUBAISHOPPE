import Link from 'next/link'
import { getStockAdjustments } from '@/actions/stock-adjustments'
import { format } from 'date-fns'
import { PlusIcon, PackageIcon } from 'lucide-react'
import type { StockAdjustmentType } from '@/types/database'

const TYPE_LABELS: Record<StockAdjustmentType, string> = {
  found:      'Found / Received',
  return:     'Customer Return',
  damage:     'Damage / Loss',
  write_off:  'Write-Off',
  correction: 'Manual Correction',
}

const TYPE_CLASSES: Record<StockAdjustmentType, string> = {
  found:      'bg-emerald-100 text-emerald-700',
  return:     'bg-blue-100 text-blue-700',
  damage:     'bg-red-100 text-red-700',
  write_off:  'bg-red-100 text-red-700',
  correction: 'bg-amber-100 text-amber-700',
}

export default async function StockAdjustmentsPage() {
  const adjustments = await getStockAdjustments()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Stock Adjustments
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {adjustments.length} total adjustment{adjustments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/stock-adjustments/new"
          className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
          <PlusIcon className="size-4" />
          New Adjustment
        </Link>
      </div>

      {adjustments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PackageIcon className="size-8 text-slate-400" />
          </div>
          <p className="font-semibold text-[#111827]">No adjustments yet</p>
          <p className="text-sm text-slate-500 mt-1">Record stock corrections, damages, or returns here</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj, i) => (
                  <tr key={adj.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{adj.products?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{adj.products?.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_CLASSES[adj.adjustment_type as StockAdjustmentType]}`}>
                        {TYPE_LABELS[adj.adjustment_type as StockAdjustmentType]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${adj.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm max-w-xs truncate">
                      {adj.notes ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                      {format(new Date(adj.created_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
