'use client'

import { useState } from 'react'
import { XIcon, BanknoteIcon, SmartphoneIcon, CreditCardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { round2 } from '@/lib/gst'

type PaymentMethod = 'cash' | 'upi' | 'card'

interface PaymentModalProps {
  grandTotal: number
  onConfirm: (method: PaymentMethod) => void
  onClose: () => void
  submitting: boolean
}

const METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <BanknoteIcon className="size-5" /> },
  { value: 'upi', label: 'UPI', icon: <SmartphoneIcon className="size-5" /> },
  { value: 'card', label: 'Card', icon: <CreditCardIcon className="size-5" /> },
]

export function PaymentModal({ grandTotal, onConfirm, onClose, submitting }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm mx-4 rounded-xl bg-background border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Confirm Payment</h2>
          <button type="button" onClick={onClose} disabled={submitting}>
            <XIcon className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">Total Amount</p>
            <p className="text-3xl font-bold mt-1">₹{round2(grandTotal).toFixed(2)}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={[
                    'flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-medium transition-colors',
                    method === m.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button
            className="w-full"
            onClick={() => onConfirm(method)}
            disabled={submitting}
          >
            {submitting ? 'Processing…' : `Confirm ${method.toUpperCase()} Payment`}
          </Button>
        </div>
      </div>
    </div>
  )
}
