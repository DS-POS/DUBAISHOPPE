import Link from 'next/link'
import { getAllQuotations } from '@/actions/quotations'
import { PlusIcon, FileTextIcon } from 'lucide-react'
import type { QuotationStatus } from '@/types/database'
import { QuotationList } from '@/components/quotations/QuotationList'

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
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
          <h1 className="text-2xl font-bold text-slate-900">
            Quotations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {allQuotations.length} total quotation{allQuotations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-200"
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
              ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px'
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
                ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px'
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
          <p className="font-semibold text-slate-900">No quotations found</p>
          <p className="text-sm text-slate-500 mt-1">
            {activeStatus === 'all'
              ? 'Create your first quotation to get started'
              : `No ${activeStatus} quotations`}
          </p>
          {activeStatus === 'all' && (
            <Link
              href="/quotations/new"
              className="mt-4 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <PlusIcon className="size-4" />
              New Quotation
            </Link>
          )}
        </div>
      ) : (
        <QuotationList quotations={filtered} />
      )}
    </div>
  )
}
