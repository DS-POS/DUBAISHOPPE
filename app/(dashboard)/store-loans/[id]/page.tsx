import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStoreLoan } from '@/actions/store-loans'
import { LoanActions } from '@/components/store-loans/LoanActions'
import { ArrowLeftIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function StoreLoanDetailPage({ params }: { params: { id: string } }) {
  const loan = await getStoreLoan(params.id)
  if (!loan) notFound()

  const isLentOut = loan.direction === 'lent_out'
  const overdue = loan.status === 'pending' && loan.expected_return_date
    ? new Date(loan.expected_return_date) < new Date()
    : false

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/store-loans" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeftIcon className="size-3.5" /> Store Loans
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{loan.product_name}</h1>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              isLentOut ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isLentOut ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownLeftIcon className="size-3" />}
              {isLentOut ? 'Lent Out' : 'Borrowed In'}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{loan.store_name} · {loan.person_name}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${
          loan.status === 'pending'
            ? overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            : loan.status === 'returned' ? 'bg-emerald-100 text-emerald-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {loan.status === 'pending' && overdue
            ? 'Overdue'
            : loan.status.charAt(0).toUpperCase() + loan.status.slice(1).replace(/_/g, ' ')}
        </span>
      </div>

      {/* Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Store</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.store_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Person</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.person_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Product</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.product_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Quantity</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Price</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {loan.price != null ? `₹${formatINR(Number(loan.price))}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Loan Date</p>
            <p className="font-semibold text-slate-900 mt-0.5">{formatDate(loan.loan_date)}</p>
          </div>
          {loan.expected_return_date && (
            <div>
              <p className="text-xs text-slate-500">Expected Return</p>
              <p className={`font-semibold mt-0.5 ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
                {formatDate(loan.expected_return_date)}
                {overdue && ' (Overdue)'}
              </p>
            </div>
          )}
          {loan.returned_date && (
            <div>
              <p className="text-xs text-slate-500">Returned On</p>
              <p className="font-semibold text-emerald-700 mt-0.5">{formatDate(loan.returned_date)}</p>
            </div>
          )}
        </div>

        {loan.notes && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">Notes</p>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{loan.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <LoanActions loan={loan} />
    </div>
  )
}
