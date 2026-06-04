'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addInvoicePayment, deleteInvoicePayment } from '@/actions/invoice-payments'
import { format, parseISO } from 'date-fns'
import type { InvoicePayment } from '@/types/database'

interface Props {
  invoiceId: string
  grandTotal: number
  amountPaid: number
  payments: InvoicePayment[]
  invoiceStatus: string
}

export function RecordPaymentDialog({ invoiceId, grandTotal, amountPaid, payments, invoiceStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit'>('cash')
  const [reference, setReference] = useState('')
  const [isPending, startTransition] = useTransition()

  const dueAmount = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > dueAmount + 0.01) { toast.error(`Amount exceeds due (₹${dueAmount.toFixed(2)})`); return }

    startTransition(async () => {
      try {
        await addInvoicePayment({
          invoice_id: invoiceId,
          amount: amt,
          payment_date: paymentDate,
          payment_method: method,
          payment_reference: reference || undefined,
        })
        toast.success('Payment recorded')
        setOpen(false)
        setAmount('')
        setReference('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record payment')
      }
    })
  }

  function handleDelete(paymentId: string) {
    if (!window.confirm('Delete this payment record?')) return
    startTransition(async () => {
      try {
        await deleteInvoicePayment(paymentId, invoiceId)
        toast.success('Payment deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete payment')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Payment History Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#0F172A]">Payment History</h3>
          {invoiceStatus !== 'paid' && dueAmount > 0 && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <PlusIcon className="size-3.5 mr-1" />
              Record Payment
            </Button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {invoiceStatus === 'paid' ? 'Invoice is fully paid.' : 'No payments recorded yet.'}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Method</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Reference</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Amount</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2 text-xs">{format(parseISO(p.payment_date), 'dd MMM yyyy')}</td>
                    <td className="px-3 py-2 text-xs capitalize">{p.payment_method ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.payment_reference ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-emerald-600">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={isPending}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog / Modal — simple inline form */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Record Payment</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="text-sm text-muted-foreground">
              Balance due: <span className="font-bold text-red-600">₹{dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder={`Max ₹${dueAmount.toFixed(2)}`}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as typeof method)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reference / Notes (optional)</label>
                <Input
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="UTR, cheque no, etc."
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={isPending} className="flex-1">
                  {isPending ? 'Recording...' : 'Record Payment'}
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
