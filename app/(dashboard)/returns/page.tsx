import Link from 'next/link'
import { format } from 'date-fns'
import { getSalesReturns } from '@/actions/sales-returns'
import { DeleteReturnButton } from '@/components/sales-returns/DeleteReturnButton'

const REFUND_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card',
  bank_transfer: 'Bank Transfer', store_credit: 'Store Credit', no_refund: 'No Refund',
}

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default async function ReturnsPage() {
  const returns = await getSalesReturns()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Returns</h1>
        <p className="text-slate-500 text-sm mt-1">{returns.length} return{returns.length !== 1 ? 's' : ''} processed</p>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-slate-400">↩</span>
          </div>
          <p className="font-semibold text-slate-700">No returns yet</p>
          <p className="text-slate-400 text-sm mt-1">Process a return from an invoice detail page</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Return No</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">Reason</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">Refund</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(ret => (
                <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{ret.return_no}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{ret.invoices?.invoice_no ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600 hidden sm:table-cell max-w-xs truncate">{ret.reason}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {REFUND_LABELS[ret.refund_method] ?? ret.refund_method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">₹{formatINR(ret.total_refund)}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">{format(new Date(ret.created_at), 'd MMM yyyy')}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/returns/${ret.id}`} className="text-xs text-blue-600 hover:underline font-medium">View</Link>
                      <DeleteReturnButton returnId={ret.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
