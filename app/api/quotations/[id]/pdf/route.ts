import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { getQuotation } from '@/actions/quotations'
import { getSettings } from '@/actions/settings'
import type { BankAccount } from '@/actions/settings'
import { QuotationPDF } from '@/components/quotations/QuotationPDF'

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ext = url.toLowerCase().includes('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${Buffer.from(buf).toString('base64')}`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [quotation, settings] = await Promise.all([getQuotation(id), getSettings()])

  if (!quotation) return new Response('Quotation not found', { status: 404 })

  let stampBase64: string | undefined
  let signatureBase64: string | undefined

  if (settings.stamp_image_url) {
    try { stampBase64 = await fetchImageAsBase64(settings.stamp_image_url) } catch { /* skip */ }
  }
  if (settings.signature_image_url) {
    try { signatureBase64 = await fetchImageAsBase64(settings.signature_image_url) } catch { /* skip */ }
  }

  // Pick the bank account saved with the quotation
  let bankAccount: BankAccount | null = null
  if (
    quotation.selected_bank_index !== null &&
    quotation.selected_bank_index !== undefined &&
    settings.bank_accounts[quotation.selected_bank_index]
  ) {
    bankAccount = settings.bank_accounts[quotation.selected_bank_index]
  }

  const element = createElement(QuotationPDF, {
    quotation,
    items: quotation.quotation_items ?? [],
    customer: quotation.customers ?? null,
    bankAccount,
    termsConditions: settings.terms_conditions,
    stampBase64,
    signatureBase64,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quotation.quotation_no}.pdf"`,
    },
  })
}
