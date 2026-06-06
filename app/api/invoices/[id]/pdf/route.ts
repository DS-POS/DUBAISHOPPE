import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { getInvoice, getLinkedInvoice } from '@/actions/invoices'
import { getInvoiceReturnsWithItems } from '@/actions/sales-returns'
import { InvoicePDF } from '@/components/invoices/InvoicePDF'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  const [linkedInvoice, returns] = await Promise.all([
    invoice.order_group_id
      ? getLinkedInvoice(invoice.order_group_id, invoice.id)
      : Promise.resolve(null),
    getInvoiceReturnsWithItems(invoice.id),
  ])

  const element = createElement(InvoicePDF, {
    invoice,
    items: invoice.invoice_items ?? [],
    customer: invoice.customers ?? null,
    linkedInvoice,
    returns: returns.length > 0 ? returns : undefined,
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
