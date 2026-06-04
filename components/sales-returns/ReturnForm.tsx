'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSalesReturn, type ReturnLineInput } from '@/actions/sales-returns'
import type { ReturnRefundMethod } from '@/types/database'

interface ReturnableItem {
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  original_qty: number
  already_returned: number
  returnable_qty: number
  rate: number
  discount: number
  gst_rate: number
}

interface Props {
  invoiceId: string
  invoiceNo: string
  customerState: string
  items: ReturnableItem[]
}

const REFUND_METHODS: { value: ReturnRefundMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'no_refund', label: 'No Refund / Exchange' },
]

export function ReturnForm({ invoiceId, invoiceNo, customerState, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('cash')
  const [notes, setNotes] = useState('')

  function toggleItem(id: string) {
    setSelected(prev => {
      if (prev[id] !== undefined) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
  }

  function setQty(id: string, qty: number) {
    const item = items.find(i => i.invoice_item_id === id)
    if (!item) return
    const clamped = Math.min(Math.max(1, qty), item.returnable_qty)
    setSelected(prev => ({ ...prev, [id]: clamped }))
  }

  const selectedItems = items.filter(i => selected[i.invoice_item_id] !== undefined)
  const totalRefund = selectedItems.reduce((s, i) => {
    const qty = selected[i.invoice_item_id] ?? 0
    const taxable = i.rate * qty - (i.discount / i.original_qty) * qty
    const gst = taxable * (i.gst_rate / 100)
    return s + taxable + gst
  }, 0)

  function handleSubmit() {
    if (selectedItems.length === 0) { toast.error('Select at least one item to return.'); return }
    if (!reason.trim()) { toast.error('Enter a reason for the return.'); return }

    const returnItems: ReturnLineInput[] = selectedItems.map(i => ({
      invoice_item_id: i.invoice_item_id,
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      serial_number: i.serial_number,
      quantity_returned: selected[i.invoice_item_id] ?? 1,
      rate: i.rate,
      discount: i.discount,
      gst_rate: i.gst_rate,
      customer_state: customerState,
    }))

    startTransition(async () => {
      try {
        const returnId = await createSalesReturn({
          invoice_id: invoiceId,
          reason,
          refund_method: refundMethod,
          notes: notes.trim() || undefined,
          items: returnItems,
        })
        toast.success('Return processed successfully.')
        router.push(`/returns/${returnId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Return failed.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Select Items to Return</h3>
        <div className="space-y-3">
          {items.map(item => {
            const isSelected = selected[item.invoice_item_id] !== undefined
            return (
              <div
                key={item.invoice_item_id}
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => toggleItem(item.invoice_item_id)}
              >
                <input type="checkbox" readOnly checked={isSelected} className="size-4 accent-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-slate-500">
                    {item.sku}{item.serial_number && ` · S/N: ${item.serial_number}`}
                    {' '}· Max: {item.returnable_qty}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">₹{item.rate.toFixed(2)}</p>
                {isSelected && (
                  <div onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={1}
                      max={item.returnable_qty}
                      value={selected[item.invoice_item_id]}
                      onChange={e => setQty(item.invoice_item_id, parseInt(e.target.value) || 1)}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Reason for Return *</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Defective product, Wrong item, Customer changed mind"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Refund Method</label>
          <div className="flex flex-wrap gap-2">
            {REFUND_METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setRefundMethod(m.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${refundMethod === m.value ? 'bg-[#111827] text-white border-[#111827]' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 resize-none"
          />
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <strong>{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected.</strong>
          {' '}Estimated refund: <strong>₹{totalRefund.toFixed(2)}</strong>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || selectedItems.length === 0}
          className="px-6 py-2.5 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
        >
          {isPending ? 'Processing…' : 'Process Return'}
        </button>
      </div>
    </div>
  )
}
