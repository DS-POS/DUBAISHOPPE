import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { getInvoice } from '@/actions/invoices'
import { InvoicePDF } from '@/components/invoices/InvoicePDF'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  const element = createElement(InvoicePDF, {
    invoice,
    items: invoice.invoice_items ?? [],
    customer: invoice.customers ?? null,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_no}.pdf"`,
    },
  })
}
