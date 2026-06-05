'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { markLoanReturned, deleteStoreLoan } from '@/actions/store-loans'
import type { StoreLoan } from '@/types/database'

interface LoanActionsProps {
  loan: StoreLoan
}

export function LoanActions({ loan }: LoanActionsProps) {
  const router = useRouter()
  const [markingReturned, setMarkingReturned] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleMarkReturned() {
    setMarkingReturned(true)
    try {
      await markLoanReturned(loan.id)
      toast.success('Marked as returned')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setMarkingReturned(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this loan record? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteStoreLoan(loan.id)
      toast.success('Loan deleted')
      router.push('/store-loans')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {loan.status === 'pending' && (
        <button
          onClick={handleMarkReturned}
          disabled={markingReturned}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {markingReturned ? 'Updating...' : '✓ Mark as Returned'}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  )
}
