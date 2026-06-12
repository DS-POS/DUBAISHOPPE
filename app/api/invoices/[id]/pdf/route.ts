import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import QRCode from 'qrcode'
import { getInvoice, getLinkedInvoice } from '@/actions/invoices'
import { getInvoiceReturnsWithItems } from '@/actions/sales-returns'
import { getSettings } from '@/actions/settings'
import { STORE } from '@/lib/store-constants'
import { InvoicePDF } from '@/components/invoices/InvoicePDF'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  const [linkedInvoice, returns, settings] = await Promise.all([
    invoice.order_group_id
      ? getLinkedInvoice(invoice.order_group_id, invoice.id)
      : Promise.resolve(null),
    getInvoiceReturnsWithItems(invoice.id),
    getSettings(),
  ])

  const bankAccount = settings.bank_accounts[0] ?? null

  const balanceDue = Math.max(0, invoice.grand_total - (invoice.total_returns ?? 0) - invoice.amount_paid)
  const upiUrl = balanceDue > 0
    ? `upi://pay?pa=${STORE.upi_id}&pn=${encodeURIComponent(STORE.name)}&am=${balanceDue.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoice_no)}`
    : `upi://pay?pa=${STORE.upi_id}&pn=${encodeURIComponent(STORE.name)}&cu=INR`
  const upiQrDataUrl = await QRCode.toDataURL(upiUrl, { width: 100, margin: 1, errorCorrectionLevel: 'M' })

  const element = createElement(InvoicePDF, {
    invoice,
    items: invoice.invoice_items ?? [],
    customer: invoice.customers ?? null,
    linkedInvoice,
    returns: returns.length > 0 ? returns : undefined,
    invoiceTerms: settings.invoice_terms_conditions,
    bankAccount,
    upiQrDataUrl,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const filename = linkedInvoice
    ? `${invoice.invoice_no}+${linkedInvoice.invoice_no}.pdf`
    : `${invoice.invoice_no}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
