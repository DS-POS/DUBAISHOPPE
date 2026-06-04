import Link from 'next/link'
import { getAllQuotations } from '@/actions/quotations'
import { format } from 'date-fns'
import { PlusIcon, FileTextIcon } from 'lucide-react'
import { round2 } from '@/lib/gst'
import type { QuotationStatus } from '@/types/database'
import { QuotationRowActions } from '@/components/quotations/QuotationRowActions'

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
}

const STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
}

const ALL_STATUSES: QuotationStatus[] = ['draft', 'sent', 'accepted', 'expired', 'rejected']

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const allQuotations = await getAllQuotations()
  const activeStatus = params.status ?? 'all'

  const filtered =
    activeStatus === 'all'
      ? allQuotations
      : allQuotations.filter(q => q.status === activeStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#111827]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            Quotations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {allQuotations.length} total quotation{allQuotations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-200"
        >
          <PlusIcon className="size-4" />
          New Quotation
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <Link
          href="/quotations"
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeStatus === 'all'
              ? 'bg-white border border-b-white border-slate-200 text-[#111827] -mb-px'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All ({allQuotations.length})
        </Link>
        {ALL_STATUSES.map(tab => (
          <Link
            key={tab}
            href={`/quotations?status=${tab}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
              activeStatus === tab
                ? 'bg-white border border-b-white border-slate-200 text-[#111827] -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {STATUS_LABELS[tab]} ({allQuotations.filter(q => q.status === tab).length})
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileTextIcon className="size-8 text-slate-400" />
          </div>
          <p className="font-semibold text-[#111827]">No quotations found</p>
          <p className="text-sm text-slate-500 mt-1">
            {activeStatus === 'all'
              ? 'Create your first quotation to get started'
              : `No ${activeStatus} quotations`}
          </p>
          {activeStatus === 'all' && (
            <Link
              href="/quotations/new"
              className="mt-4 inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <PlusIcon className="size-4" />
              New Quotation
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wider">Quotation #</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wider">Valid Until</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 w-32 text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => (
                  <tr
                    key={q.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors row-hover ${
                      i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-[#111827] whitespace-nowrap">
                      {q.quotation_no}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {q.customers?.name ?? <span className="text-slate-400">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      ₹{round2(q.grand_total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 whitespace-nowrap">
                      {q.valid_until
                        ? format(new Date(q.valid_until), 'dd MMM yyyy')
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          STATUS_CLASSES[q.status as QuotationStatus]
                        }`}
                      >
                        {STATUS_LABELS[q.status as QuotationStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 whitespace-nowrap">
                      {format(new Date(q.quotation_date ?? q.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <QuotationRowActions quotationId={q.id} status={q.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
