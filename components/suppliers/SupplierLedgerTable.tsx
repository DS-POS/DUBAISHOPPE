import type { LedgerTransaction } from '@/actions/supplier-invoices'

interface Props {
  transactions: LedgerTransaction[]
  totalInvoiced: number
  totalPaid: number
  closingBalance: number
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export function SupplierLedgerTable({ transactions, totalInvoiced, totalPaid, closingBalance }: Props) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <div className="p-4"><p className="text-xs text-slate-500">Total Invoiced</p><p className="text-lg font-bold text-slate-900 mt-0.5">{fmt(totalInvoiced)}</p></div>
        <div className="p-4"><p className="text-xs text-slate-500">Total Paid</p><p className="text-lg font-bold text-emerald-600 mt-0.5">{fmt(totalPaid)}</p></div>
        <div className="p-4"><p className="text-xs text-slate-500">Balance Due</p><p className={`text-lg font-bold mt-0.5 ${closingBalance > 0 ? 'text-red-600' : 'text-slate-400'}`}>{fmt(closingBalance)}</p></div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Reference</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Debit (₹)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Credit (₹)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Balance (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map(tx => (
            <tr key={tx.id} className={`hover:bg-slate-50 ${tx.type === 'payment' ? 'bg-emerald-50/30' : ''}`}>
              <td className="px-4 py-3 text-slate-600">{new Date(tx.date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
              <td className="px-4 py-3 text-slate-700 font-medium">{tx.reference}</td>
              <td className="px-4 py-3 text-slate-600">{tx.description}</td>
              <td className="px-4 py-3 text-right font-medium text-red-600">{tx.debit > 0 ? fmt(tx.debit) : '—'}</td>
              <td className="px-4 py-3 text-right font-medium text-emerald-600">{tx.credit > 0 ? fmt(tx.credit) : '—'}</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(tx.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
