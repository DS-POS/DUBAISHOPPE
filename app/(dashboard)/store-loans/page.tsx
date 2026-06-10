import { getStoreLoans } from '@/actions/store-loans'
import Link from 'next/link'
import { PlusIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'
import type { StoreLoanDirection, StoreLoanStatus } from '@/types/database'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const DIRECTION_LABEL: Record<StoreLoanDirection, string> = {
  lent_out: 'Lent Out',
  borrowed_in: 'Borrowed In',
}

const STATUS_STYLES: Record<StoreLoanStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  returned: 'bg-emerald-50 text-emerald-700',
  converted_to_invoice: 'bg-blue-50 text-blue-700',
}

const STATUS_LABELS: Record<StoreLoanStatus, string> = {
  pending: 'Pending',
  returned: 'Returned',
  converted_to_invoice: 'Invoiced',
}

export default async function StoreLoansPage({
  searchParams,
}: {
  searchParams: { direction?: string; status?: string }
}) {
  const VALID_DIRECTIONS: StoreLoanDirection[] = ['lent_out', 'borrowed_in']
  const VALID_STATUSES: StoreLoanStatus[] = ['pending', 'returned', 'converted_to_invoice']
  const direction = VALID_DIRECTIONS.includes(searchParams.direction as StoreLoanDirection)
    ? (searchParams.direction as StoreLoanDirection)
    : undefined
  const status = VALID_STATUSES.includes(searchParams.status as StoreLoanStatus)
    ? (searchParams.status as StoreLoanStatus)
    : undefined

  const loans = await getStoreLoans({ direction, status })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store Loans</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inter-store item lending &amp; borrowing</p>
        </div>
        <Link
          href="/store-loans/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <PlusIcon className="size-4" />
          Record Loan
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', href: '/store-loans', active: !direction && !status },
          { label: 'Lent Out', href: '/store-loans?direction=lent_out', active: direction === 'lent_out' },
          { label: 'Borrowed In', href: '/store-loans?direction=borrowed_in', active: direction === 'borrowed_in' },
          { label: 'Pending', href: '/store-loans?status=pending', active: status === 'pending' },
          { label: 'Returned', href: '/store-loans?status=returned', active: status === 'returned' },
        ].map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab.active
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {loans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <ArrowUpRightIcon className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No loans recorded</p>
          <p className="text-sm text-slate-400 mt-1">Click &quot;Record Loan&quot; to add the first entry</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Direction</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Store</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">Person</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">Qty</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">Price</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.map(loan => (
                <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(loan.loan_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      loan.direction === 'lent_out' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {loan.direction === 'lent_out'
                        ? <ArrowUpRightIcon className="size-3" />
                        : <ArrowDownLeftIcon className="size-3" />
                      }
                      {DIRECTION_LABEL[loan.direction]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-900">{loan.store_name}</td>
                  <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">{loan.person_name}</td>
                  <td className="px-4 py-3.5 text-slate-700">{loan.product_name}</td>
                  <td className="px-4 py-3.5 text-right text-slate-600 hidden md:table-cell">{loan.quantity}</td>
                  <td className="px-4 py-3.5 text-right text-slate-700 font-medium hidden md:table-cell">
                    {loan.price != null ? `₹${formatINR(Number(loan.price))}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[loan.status]}`}>
                      {STATUS_LABELS[loan.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/store-loans/${loan.id}`} className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-medium transition-colors">
                      View
                    </Link>
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
