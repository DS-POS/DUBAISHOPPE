'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircleIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { recordCustomerRefund, deleteCustomerRefund } from '@/actions/customer-refunds'
import { format, parseISO } from 'date-fns'
import type { CustomerRefund } from '@/actions/customer-refunds'

interface Props {
  invoiceId: string
  orderGroupId?: string | null
  refundAmount: number
  existingRefunds: CustomerRefund[]
}

export function RecordCustomerRefundButton({ invoiceId, orderGroupId, refundAmount, existingRefunds }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(refundAmount.toFixed(2))
  const [method, setMethod] = useState('cash')
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const totalRefunded = existingRefunds.reduce((s, r) => s + Number(r.amount), 0)
  const remaining = Math.round((refundAmount - totalRefunded) * 100) / 100

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > remaining + 0.01) { toast.error(`Amount exceeds refund due (₹${remaining.toFixed(2)})`); return }

    startTransition(async () => {
      try {
        await recordCustomerRefund({
          invoice_id: invoiceId,
          order_group_id: orderGroupId ?? null,
          amount: amt,
          method,
          refund_date: refundDate,
          notes: notes || undefined,
        })
        toast.success('Refund to customer recorded')
        setOpen(false)
        setNotes('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record refund')
      }
    })
  }

  function handleDelete(refundId: string) {
    if (!window.confirm('Delete this refund record?')) return
    startTransition(async () => {
      try {
        await deleteCustomerRefund(refundId, invoiceId)
        toast.success('Refund record deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  const methodLabel = (m: string) => m.replace('_', ' ')

  return (
    <div className="mt-3 space-y-2">
      {/* Recorded refunds list */}
      {existingRefunds.length > 0 && (
        <div className="space-y-1.5">
          {existingRefunds.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">
                    Refunded ₹{Number(r.amount).toFixed(2)} to Customer
                  </p>
                  <p className="text-xs text-emerald-600 capitalize">
                    {methodLabel(r.method)} · {format(parseISO(r.refund_date), 'dd MMM yyyy')}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                disabled={isPending}
                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 ml-2 shrink-0"
                title="Delete refund record"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remaining refund button */}
      {remaining > 0.005 && (
        <button
          onClick={() => { setAmount(remaining.toFixed(2)); setOpen(true) }}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-emerald-300 rounded-lg py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
        >
          ↩ Mark Refunded to Customer · ₹{remaining.toFixed(2)}
        </button>
      )}

      {remaining <= 0.005 && existingRefunds.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-emerald-600">
          <CheckCircleIcon className="size-3.5" /> Fully Refunded to Customer
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Refund to Customer</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
              Store owes customer:{' '}
              <span className="font-black text-emerald-700">₹{remaining.toFixed(2)}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Refund Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Refund Date</label>
                <Input
                  type="date"
                  value={refundDate}
                  onChange={e => setRefundDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes / Reference (optional)</label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="UTR, cash voucher no., etc."
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPending ? 'Saving...' : 'Confirm Refund Issued'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
