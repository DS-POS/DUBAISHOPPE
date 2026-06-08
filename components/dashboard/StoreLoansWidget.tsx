import Link from 'next/link'
import { ArrowUpRightIcon, ArrowDownLeftIcon, PlusIcon } from 'lucide-react'
import type { StoreLoanStats } from '@/actions/store-loans'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface StoreLoansWidgetProps {
  stats: StoreLoanStats
}

export function StoreLoansWidget({ stats }: StoreLoansWidgetProps) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Store Loans</h3>
        <Link
          href="/store-loans/new"
          className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors"
          title="Record a loan (lent or borrowed)"
        >
          <PlusIcon className="size-4 text-slate-700" />
        </Link>
      </div>

      {/* Lent Out row */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="size-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <ArrowUpRightIcon className="size-4 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">Lent Out</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Items we gave to other stores</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black text-amber-900 tabular-nums">{stats.lent_out_pending_count}</p>
          <p className="text-[11px] text-amber-700">pending</p>
          {stats.lent_out_pending_value > 0 && (
            <p className="text-xs font-semibold text-amber-700 tabular-nums mt-0.5">₹{formatINR(stats.lent_out_pending_value)}</p>
          )}
        </div>
      </div>

      {/* Borrowed In row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="size-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <ArrowDownLeftIcon className="size-4 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-800">Borrowed In</p>
          <p className="text-[11px] text-blue-600 mt-0.5">Items we took from other stores</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black text-blue-900 tabular-nums">{stats.borrowed_in_pending_count}</p>
          <p className="text-[11px] text-blue-700">pending</p>
          {stats.borrowed_in_pending_value > 0 && (
            <p className="text-xs font-semibold text-blue-700 tabular-nums mt-0.5">₹{formatINR(stats.borrowed_in_pending_value)}</p>
          )}
        </div>
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-slate-100">
        <Link href="/store-loans" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          View all store loans →
        </Link>
      </div>
    </div>
  )
}
