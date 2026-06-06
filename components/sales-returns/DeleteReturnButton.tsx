'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteSalesReturn } from '@/actions/sales-returns'

export function DeleteReturnButton({ returnId }: { returnId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this return? Stock restoration will be reversed.')) return
    setLoading(true)
    try {
      await deleteSalesReturn(returnId)
      toast.success('Return deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
    >
      {loading ? '…' : 'Delete'}
    </button>
  )
}
