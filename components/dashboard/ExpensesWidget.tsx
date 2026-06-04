import { getExpenseSummary } from '@/actions/expenses'
import { TrendingDownIcon } from 'lucide-react'
import Link from 'next/link'

export async function ExpensesWidget() {
  const now = new Date()
  const summary = await getExpenseSummary(now.getFullYear(), now.getMonth() + 1)
  if (summary.total === 0) return null

  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-red-50 flex items-center justify-center">
            <TrendingDownIcon className="size-4 text-red-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Expenses This Month</span>
        </div>
        <Link href="/expenses" className="text-xs text-[#111827] font-medium hover:underline">View all</Link>
      </div>
      <p className="text-2xl font-black text-slate-900">₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
      <div className="mt-3 space-y-1">
        {summary.by_category.slice(0, 4).map(c => (
          <div key={c.category} className="flex justify-between text-xs text-slate-500">
            <span>{c.category}</span>
            <span className="font-medium text-slate-700">₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
