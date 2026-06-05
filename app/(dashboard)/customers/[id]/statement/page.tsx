import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCustomerById, getCustomerStatement } from '@/actions/customers'
import { StatementExportButton } from '@/components/customers/StatementExportButton'
import { StatementPrintButton } from '@/components/customers/StatementPrintButton'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default async function CustomerStatementPage({ params }: { params: { id: string } }) {
  const customer = await getCustomerById(params.id)
  if (!customer) notFound()

  const statement = await getCustomerStatement(params.id)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/customers/${params.id}`} className="print-hide text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
            ← {customer.name}
          </Link>
          <h1 className="text-2xl font-bold text-[#111827]">Account Statement</h1>
          <p className="text-slate-500 text-sm mt-1">
            {customer.name}{customer.business_name ? ` · ${customer.business_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatementPrintButton />
          <StatementExportButton statement={statement} customerName={customer.name} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Invoiced</p>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{formatINR(statement.total_invoiced)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">₹{formatINR(statement.total_paid)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${statement.closing_balance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Balance Due</p>
          <p className={`text-xl font-bold mt-1 ${statement.closing_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ₹{formatINR(Math.abs(statement.closing_balance))}
            {statement.closing_balance < 0 && <span className="text-sm font-normal ml-1">(credit)</span>}
          </p>
        </div>
      </div>

      {statement.transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500">No transactions found for this customer.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Transaction Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">{statement.transactions.length} transactions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Reference</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Description</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-red-400 uppercase tracking-wide">Debit</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide">Credit</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.transactions.map((tx, i) => (
                  <tr key={i} className={`hover:bg-slate-50 ${tx.type === 'payment' ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.date_display}</td>
                    <td className="px-5 py-3">
                      {tx.type === 'invoice' ? (
                        <span className="font-mono text-xs font-medium text-blue-600">{tx.reference}</span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Payment</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs truncate">{tx.description}</td>
                    <td className="px-5 py-3 text-right text-sm">
                      {tx.debit > 0 ? <span className="font-semibold text-red-600">₹{formatINR(tx.debit)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-sm">
                      {tx.credit > 0 ? <span className="font-semibold text-emerald-600">₹{formatINR(tx.credit)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-sm font-bold ${tx.balance > 0 ? 'text-red-600' : tx.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        ₹{formatINR(Math.abs(tx.balance))}{tx.balance < 0 && ' Cr'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3 font-semibold text-slate-700 text-sm">Closing Balance</td>
                  <td className="px-5 py-3 text-right font-semibold text-red-600 text-sm">₹{formatINR(statement.total_invoiced)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 text-sm">₹{formatINR(statement.total_paid)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-base font-bold ${statement.closing_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹{formatINR(Math.abs(statement.closing_balance))}{statement.closing_balance < 0 && ' Cr'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
