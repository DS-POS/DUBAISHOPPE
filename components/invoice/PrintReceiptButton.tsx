'use client'
import { PrinterIcon } from 'lucide-react'

interface Props {
  invoiceId: string
}

export function PrintReceiptButton({ invoiceId }: Props) {
  return (
    <a
      href={`/api/invoices/${invoiceId}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-100 active:scale-[0.98] transition-all"
    >
      <PrinterIcon className="size-4" />
      Print Invoice
    </a>
  )
}
