import Link from 'next/link'
import { ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'
import type { StoreLoanStats } from '@/actions/store-loans'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface StoreLoansWidgetProps {
  stats: StoreLoanStats
}

export function StoreLoansWidget({ stats }: StoreLoansWidgetProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* Lent Out Card */}
      <div className="bg-amber-50 rounded-2xl p-5 ring-1 ring-amber-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ArrowUpRightIcon className="size-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Lent Out</p>
              <p className="text-xs text-amber-700 mt-0.5">Items we gave to other stores</p>
            </div>
          </div>
          <Link
            href="/store-loans?direction=lent_out"
            className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            View
          </Link>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black text-amber-900">{stats.lent_out_pending_count}</p>
            <p className="text-xs text-amber-700 mt-0.5">pending returns</p>
          </div>
          {stats.lent_out_pending_value > 0 && (
            <div className="text-right">
              <p className="text-base font-bold text-amber-800">₹{formatINR(stats.lent_out_pending_value)}</p>
              <p className="text-xs text-amber-600">est. value</p>
            </div>
          )}
        </div>
        {stats.lent_out_pending_count === 0 && (
          <p className="mt-3 text-xs text-amber-600 font-medium">No pending lent items</p>
        )}
      </div>

      {/* Borrowed In Card */}
      <div className="bg-blue-50 rounded-2xl p-5 ring-1 ring-blue-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ArrowDownLeftIcon className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Borrowed In</p>
              <p className="text-xs text-blue-700 mt-0.5">Items we took from other stores</p>
            </div>
          </div>
          <Link
            href="/store-loans?direction=borrowed_in"
            className="text-xs font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            View
          </Link>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black text-blue-900">{stats.borrowed_in_pending_count}</p>
            <p className="text-xs text-blue-700 mt-0.5">pending returns</p>
          </div>
          {stats.borrowed_in_pending_value > 0 && (
            <div className="text-right">
              <p className="text-base font-bold text-blue-800">₹{formatINR(stats.borrowed_in_pending_value)}</p>
              <p className="text-xs text-blue-600">est. value</p>
            </div>
          )}
        </div>
        {stats.borrowed_in_pending_count === 0 && (
          <p className="mt-3 text-xs text-blue-600 font-medium">No borrowed items pending</p>
        )}
      </div>

    </div>
  )
}
