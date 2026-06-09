'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2Icon } from 'lucide-react'
import { deleteInvoice } from '@/actions/invoices'

export function DeleteInvoiceButton({ invoiceId, invoiceNo }: { invoiceId: string; invoiceNo: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      setTimeout(() => setConfirmed(false), 4000)
      return
    }
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId)
      if (result.error) {
        toast.error(result.error)
        setConfirmed(false)
      } else {
        toast.success(`Invoice ${invoiceNo} deleted`)
        router.push('/invoices')
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        confirmed
          ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
          : 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
      }`}
    >
      <Trash2Icon className="size-3.5" />
      {pending ? 'Deleting…' : confirmed ? 'Confirm Delete?' : 'Delete'}
    </button>
  )
}
