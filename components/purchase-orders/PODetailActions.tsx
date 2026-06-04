'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePOStatus, receivePurchaseOrder } from '@/actions/purchase-orders'
import type { POStatus } from '@/types/database'

interface Props {
  po: { id: string; status: POStatus; po_no: string }
}

export function PODetailActions({ po }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])

  function handleStatusUpdate(status: POStatus) {
    startTransition(async () => {
      try {
        await updatePOStatus(po.id, status)
        toast.success(`PO marked as ${status}.`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status.')
      }
    })
  }

  function handleReceive() {
    if (!invoiceNo.trim()) { toast.error('Enter supplier invoice number.'); return }
    if (!invoiceDate) { toast.error('Enter invoice date.'); return }
    startTransition(async () => {
      try {
        await receivePurchaseOrder(po.id, invoiceNo.trim(), invoiceDate)
        toast.success('PO received! Stock updated and supplier invoice created.')
        router.refresh()
        setShowReceiveForm(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to receive PO.')
      }
    })
  }

  if (po.status === 'received') {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-medium">
        ✓ PO received. Stock has been updated.
      </div>
    )
  }

  if (po.status === 'cancelled') {
    return <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-600">PO cancelled.</div>
  }

  return (
    <div className="space-y-4">
      {!showReceiveForm ? (
        <div className="flex flex-wrap gap-3">
          {po.status === 'draft' && (
            <button onClick={() => handleStatusUpdate('sent')} disabled={isPending} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
              Mark as Sent
            </button>
          )}
          {(po.status === 'draft' || po.status === 'sent') && (
            <button onClick={() => setShowReceiveForm(true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
              Receive PO
            </button>
          )}
          <button onClick={() => handleStatusUpdate('cancelled')} disabled={isPending} className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold">
            Cancel PO
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">Receive PO — Enter Supplier Invoice Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Supplier Invoice No *</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="e.g. SINV-2024-001" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowReceiveForm(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleReceive} disabled={isPending} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
              {isPending ? 'Receiving…' : 'Confirm Receipt & Update Stock'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
