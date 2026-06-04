import { getExpenses, getExpenseSummary } from '@/actions/expenses'
import { PlusIcon, ReceiptIcon } from 'lucide-react'
import Link from 'next/link'

export default async function ExpensesPage() {
  const now = new Date()
  const [expenses, summary] = await Promise.all([
    getExpenses({ from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01` }),
    getExpenseSummary(now.getFullYear(), now.getMonth() + 1),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">This month: <span className="font-semibold text-slate-700">₹{summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
        </div>
        <Link href="/expenses/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] text-white rounded-xl text-sm font-semibold hover:bg-[#1F2937] transition-colors">
          <PlusIcon className="size-4" />Add Expense
        </Link>
      </div>

      {summary.by_category.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {summary.by_category.map(c => (
            <div key={c.category} className="bg-white rounded-xl p-3 ring-1 ring-black/[0.06] shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{c.category}</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <ReceiptIcon className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No expenses this month</p>
          <p className="text-sm text-slate-400 mt-1">Click &quot;Add Expense&quot; to record one</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{exp.expense_categories?.name ?? '—'}</span></td>
                  <td className="px-4 py-3 text-slate-700">{exp.description}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{exp.payment_method.replace('_',' ')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
