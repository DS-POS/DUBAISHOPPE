'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { addSupplierPayment } from '@/actions/supplier-payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AddPaymentDialogProps {
  invoiceId: string
  balance: number
  onSuccess?: () => void
}

export function AddPaymentDialog({ invoiceId, balance, onSuccess }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'>('neft')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      await addSupplierPayment({
        supplier_invoice_id: invoiceId,
        amount: amt,
        payment_date: date,
        payment_reference: reference || undefined,
        payment_method: method,
        notes: notes || undefined,
      })
      toast.success('Payment recorded.')
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        + Add Payment
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" step="0.01" min="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment Method</Label>
            <select value={method} onChange={e => setMethod(e.target.value as typeof method)}
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="neft">NEFT</option>
              <option value="upi">UPI</option>
              <option value="rtgs">RTGS</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference No</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Cheque / UTR / Transaction ID" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2Icon className="size-4 animate-spin mr-2" />Saving…</> : 'Save Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
