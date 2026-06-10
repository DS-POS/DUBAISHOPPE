'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateQuotationStatus, convertQuotationToInvoice } from '@/actions/quotations'
import type { QuotationStatus } from '@/types/database'
import { ChevronDownIcon, FileCheckIcon, MessageCircleIcon, PrinterIcon, DownloadIcon } from 'lucide-react'

interface QuotationActionsProps {
  quotationId: string
  quotationNo: string
  status: QuotationStatus
  convertedInvoiceId: string | null
  grandTotal: number
  customerPhone: string | null
}

const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent', 'expired', 'rejected'],
  sent: ['accepted', 'expired', 'rejected'],
  accepted: [],
  expired: ['draft'],
  rejected: ['draft'],
}

const STATUS_TRANSITION_LABELS: Record<QuotationStatus, string> = {
  draft: 'Reset to Draft',
  sent: 'Mark as Sent',
  accepted: 'Mark as Accepted',
  expired: 'Mark as Expired',
  rejected: 'Mark as Rejected',
}

export function QuotationActions({
  quotationId,
  quotationNo,
  status,
  convertedInvoiceId,
  grandTotal,
  customerPhone,
}: QuotationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [converting, setConverting] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const transitions = STATUS_TRANSITIONS[status] ?? []

  function handleStatusChange(newStatus: QuotationStatus) {
    setShowStatusMenu(false)
    startTransition(async () => {
      try {
        await updateQuotationStatus(quotationId, newStatus)
        toast.success(`Status updated to ${newStatus}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  async function handleConvert() {
    if (!confirm('Convert this quotation to an invoice? This cannot be undone.')) return
    setConverting(true)
    try {
      const invoiceId = await convertQuotationToInvoice(quotationId)
      toast.success('Quotation converted to invoice!')
      router.push(`/invoices/${invoiceId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert to invoice')
      setConverting(false)
    }
  }

  function handleWhatsApp() {
    const msg = `Hi! Please find your quotation *${quotationNo}* for ₹${grandTotal.toFixed(2)}.\n\nThank you for your interest in Dubai Shoppe.`
    const phone = customerPhone?.replace(/[^0-9]/g, '') ?? ''
    const url = `https://wa.me/${phone ? `91${phone}` : ''}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function handleDownloadPDF() {
    window.open(`/api/quotations/${quotationId}/pdf`, '_blank')
  }

  const canConvert = status !== 'accepted' && status !== 'rejected'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Download PDF */}
      <button
        type="button"
        onClick={handleDownloadPDF}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <DownloadIcon className="size-4 text-slate-500" />
        PDF
      </button>

      {/* WhatsApp */}
      <button
        type="button"
        onClick={handleWhatsApp}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <MessageCircleIcon className="size-4 text-green-600" />
        WhatsApp
      </button>

      {/* Print */}
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <PrinterIcon className="size-4 text-slate-500" />
        Print
      </button>

      {/* Status change dropdown */}
      {transitions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusMenu(v => !v)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
          >
            Update Status
            <ChevronDownIcon className="size-3.5" />
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-20 overflow-hidden">
              {transitions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-slate-700"
                >
                  {STATUS_TRANSITION_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Convert to Invoice */}
      {canConvert && !convertedInvoiceId && (
        <button
          type="button"
          onClick={handleConvert}
          disabled={converting}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white shadow-sm disabled:opacity-50"
        >
          <FileCheckIcon className="size-4" />
          {converting ? 'Converting…' : 'Convert to Invoice'}
        </button>
      )}

      {/* View Invoice (if converted) */}
      {convertedInvoiceId && (
        <a
          href={`/invoices/${convertedInvoiceId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
        >
          <FileCheckIcon className="size-4" />
          View Invoice
        </a>
      )}
    </div>
  )
}
