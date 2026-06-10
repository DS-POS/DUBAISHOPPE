'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { deleteQuotation } from '@/actions/quotations'
import { Trash2Icon } from 'lucide-react'

interface QuotationRowActionsProps {
  quotationId: string
  status: string
}

export function QuotationRowActions({ quotationId, status }: QuotationRowActionsProps) {
  const router = useRouter()
  const [isDeleting, startDelete] = useTransition()
  const isDraft = status === 'draft'

  function handleDelete() {
    if (!confirm('Delete this quotation? This cannot be undone.')) return
    startDelete(async () => {
      try {
        await deleteQuotation(quotationId)
        toast.success('Quotation deleted')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/quotations/${quotationId}`}
        className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        View
      </Link>
      {isDraft && (
        <Link
          href={`/quotations/${quotationId}/edit`}
          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Edit
        </Link>
      )}
      {isDraft && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          title="Delete quotation"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      )}
    </div>
  )
}
