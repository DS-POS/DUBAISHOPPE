import Link from 'next/link'
import { getStockAdjustments } from '@/actions/stock-adjustments'
import { PlusIcon, PackageIcon } from 'lucide-react'
import { StockAdjustmentsListClient } from '@/components/stock-adjustments/StockAdjustmentsListClient'


export default async function StockAdjustmentsPage() {
  const adjustments = await getStockAdjustments()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Stock Adjustments
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {adjustments.length} total adjustment{adjustments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/stock-adjustments/new"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
          <PlusIcon className="size-4" />
          New Adjustment
        </Link>
      </div>

      {adjustments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PackageIcon className="size-8 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-900">No adjustments yet</p>
          <p className="text-sm text-slate-500 mt-1">Record stock corrections, damages, or returns here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <StockAdjustmentsListClient adjustments={adjustments} />
        </div>
      )}
    </div>
  )
}
