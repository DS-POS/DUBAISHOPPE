'use client'

import { useState } from 'react'
import { DownloadIcon, MessageCircleIcon, MailIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { sendInvoiceEmail } from '@/actions/send-invoice-email'
import { Button } from '@/components/ui/button'
import { round2 } from '@/lib/gst'

interface InvoiceShareButtonsProps {
  invoiceId: string
  invoiceNo: string
  grandTotal: number
  customerEmail: string | null
  customerPhone: string | null
}

export function InvoiceShareButtons({
  invoiceId, invoiceNo, grandTotal, customerEmail, customerPhone
}: InvoiceShareButtonsProps) {
  const [emailSending, setEmailSending] = useState(false)

  function handleDownload() {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Dear Customer,\n\nThank you for your purchase.\n\nInvoice: *${invoiceNo}*\nAmount: *₹${round2(grandTotal).toFixed(2)}*\n\nDownload your invoice: ${window.location.origin}/api/invoices/${invoiceId}/pdf\n\nDubai Shoppe`
    )
    const phone = customerPhone?.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${phone ? `91${phone}` : ''}?text=${msg}`, '_blank')
  }

  async function handleEmail() {
    if (!customerEmail) {
      toast.error('No email on record for this customer.')
      return
    }
    setEmailSending(true)
    try {
      await sendInvoiceEmail(invoiceId, customerEmail)
      toast.success(`Invoice emailed to ${customerEmail}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email failed.')
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <DownloadIcon className="size-4 mr-1.5" />PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleWhatsApp}>
        <MessageCircleIcon className="size-4 mr-1.5" />WhatsApp
      </Button>
      <Button variant="outline" size="sm" onClick={handleEmail} disabled={emailSending || !customerEmail}>
        {emailSending ? <Loader2Icon className="size-4 mr-1.5 animate-spin" /> : <MailIcon className="size-4 mr-1.5" />}
        Email
      </Button>
    </div>
  )
}
