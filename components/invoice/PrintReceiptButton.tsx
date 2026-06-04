'use client'
import { PrinterIcon } from 'lucide-react'

export function PrintReceiptButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <PrinterIcon className="size-4" />
      Print Receipt
    </button>
  )
}
