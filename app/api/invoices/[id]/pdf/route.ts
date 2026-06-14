export const dynamic = 'force-dynamic'

import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import { STORE } from '@/lib/store-constants'
import { InvoicePDF } from '@/components/invoices/InvoicePDF'
import type { BankAccount } from '@/lib/settings-types'

const DEFAULT_INVOICE_TERMS: string[] = [
  'Warranty to be claimed at authorised service centre only; not entertained by dealer. Terms as per manufacturer/importer policy.',
  'Finance at sole discretion of funding institution. Card charges apply when price is discounted.',
  'Cheques subject to realisation; goods delivered only after clearance.',
  'Prices are inclusive of GST unless otherwise stated. Dubai Shoppe reserves the right to cancel orders in case of pricing or stock errors.',
  'Advance payments are non-refundable for special orders, customised products, or items procured on customer request.',
  'Goods once sold will not be taken back or exchanged unless found defective under manufacturer warranty.',
  'No Exchange. No Return. Please inspect and verify your product at the time of collection. Subject to local jurisdiction.',
]

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = getAdminClient()

  // Fetch invoice with items + customer using service role (bypasses RLS for public PDF links)
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('*, customers(*), invoice_items(*)')
    .eq('id', params.id)
    .single()

  if (invoiceError || !invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  // Fetch linked invoice (BOS pair) if applicable
  let linkedInvoice = null
  if (invoice.order_group_id) {
    const { data: linked } = await admin
      .from('invoices')
      .select('*, invoice_items(*), customers(*)')
      .eq('order_group_id', invoice.order_group_id)
      .neq('id', invoice.id)
      .single()
    linkedInvoice = linked ?? null
  }

  // Fetch returns
  const { data: returnsRaw } = await admin
    .from('sales_returns')
    .select('*, sales_return_items(*)')
    .eq('invoice_id', invoice.id)
    .order('created_at', { ascending: true })
  const returns = returnsRaw ?? []

  // Fetch settings using service role
  const { data: settingsRows } = await admin
    .from('settings')
    .select('key, value')
    .in('key', [
      'bank_accounts', 'bank_name', 'bank_account_name', 'bank_account_number',
      'bank_ifsc', 'bank_branch', 'invoice_terms_conditions',
    ])

  const map: Record<string, string> = {}
  for (const row of (settingsRows ?? [])) map[row.key] = row.value ?? ''

  let bankAccounts: BankAccount[] = []
  if (map['bank_accounts']) {
    try {
      const parsed = JSON.parse(map['bank_accounts'])
      if (Array.isArray(parsed)) bankAccounts = parsed as BankAccount[]
    } catch { /* ignore */ }
  }
  if (bankAccounts.length === 0 && map['bank_name']) {
    bankAccounts = [{
      bank_name: map['bank_name'],
      account_name: map['bank_account_name'] ?? '',
      account_number: map['bank_account_number'] ?? '',
      ifsc: map['bank_ifsc'] ?? '',
      branch: map['bank_branch'] ?? '',
    }]
  }

  let invoiceTerms: string[] = DEFAULT_INVOICE_TERMS
  if (map['invoice_terms_conditions']) {
    try {
      const parsed = JSON.parse(map['invoice_terms_conditions'])
      if (Array.isArray(parsed)) invoiceTerms = parsed as string[]
    } catch { /* ignore */ }
  }

  const bankAccount = bankAccounts[0] ?? null

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
    invoiceTerms,
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
