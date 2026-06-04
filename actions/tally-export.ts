'use server'

import { createClient } from '@/lib/supabase/server'
import { STORE } from '@/lib/store-constants'

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function amt(n: number | null | undefined): string {
  return (Number(n ?? 0)).toFixed(2)
}

/** YYYYMMDD — Tally date format */
function tallyDate(iso: string): string {
  return iso.split('T')[0].replace(/-/g, '')
}

function xmlHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>`
}

function wrapEnvelope(company: string, reportName: string, body: string): string {
  return `${xmlHeader()}
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${esc(reportName)}</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${body}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

/** Payment method → Tally ledger name (fallback mapping) */
function paymentLedger(
  method: string | null,
  ledgerMap: Record<string, string>
): string {
  switch (method) {
    case 'cash':          return ledgerMap['cash_sales']    ?? 'Cash'
    case 'upi':           return ledgerMap['upi_sales']     ?? 'UPI Bank Ledger'
    case 'card':          return ledgerMap['card_sales']    ?? 'Card Settlement Ledger'
    case 'bank_transfer': return ledgerMap['upi_sales']     ?? 'UPI Bank Ledger'
    case 'credit':        return ledgerMap['customer_ledger'] ?? 'Sundry Debtors'
    default:              return 'Cash'
  }
}

/** Fetch ledger map — deduplicate duplicate seed rows by taking first per pos_field */
async function fetchLedgerMap(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('tally_ledger_mapping')
    .select('pos_field, tally_ledger_name')
    .order('created_at', { ascending: true })

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    if (!map[row.pos_field]) {
      map[row.pos_field] = row.tally_ledger_name
    }
  }
  return map
}

/** Log export to export_logs */
async function logExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exportType: string,
  dateFrom: string | null,
  dateTo: string | null
): Promise<void> {
  await supabase.from('export_logs').insert({
    export_type: exportType,
    date_from: dateFrom,
    date_to: dateTo,
    created_by: userId,
  })
}

// ── Sales Vouchers ─────────────────────────────────────────────────────────

export async function exportSalesVouchersXML(from: string, to: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ledgerMap = await fetchLedgerMap(supabase)

  const fromDate = `${from}T00:00:00.000Z`
  const toDate   = `${to}T23:59:59.999Z`

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, customers(name, gstin, state), invoice_items(*)')
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const messages: string[] = []

  for (const inv of invoices ?? []) {
    const customer = (inv as never as { customers: { name: string; gstin: string | null; state: string } | null }).customers
    const isIGST   = Number(inv.igst) > 0

    const customerLedger = ledgerMap['customer_ledger'] ?? 'Sundry Debtors'
    const salesLedger    = ledgerMap['sales_18_gst']    ?? 'Sales GST 18%'
    const cgstLedger     = ledgerMap['cgst_output']     ?? 'Output CGST'
    const sgstLedger     = ledgerMap['sgst_output']     ?? 'Output SGST'
    const igstLedger     = ledgerMap['igst_output']     ?? 'Output IGST'

    const grandTotal    = Number(inv.grand_total)
    const taxableAmount = Number(inv.taxable_amount)
    const cgst          = Number(inv.cgst)
    const sgst          = Number(inv.sgst)
    const igst          = Number(inv.igst)

    const partyName = customer?.name ? esc(customer.name) : customerLedger

    // Build ledger entries
    let entries = ''

    // 1. Party (debit — negative in Tally = debit)
    entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amt(grandTotal)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`

    // 2. Sales ledger (taxable amount)
    entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(taxableAmount)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`

    // 3. GST entries
    if (isIGST) {
      entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(igstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(igst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
    } else {
      if (cgst > 0) {
        entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(cgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(cgst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
      }
      if (sgst > 0) {
        entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(sgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(sgst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
      }
    }

    // 4. Payment entry (for paid / partial-paid invoices)
    const amountPaid = Number(inv.amount_paid ?? 0)
    if (amountPaid > 0 && inv.payment_method !== 'credit') {
      const pmtLedger = paymentLedger(inv.payment_method, ledgerMap)
      entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(pmtLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(amountPaid)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
    }

    messages.push(`
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${tallyDate(inv.created_at)}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${esc(inv.invoice_no)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>${entries}
          </VOUCHER>
        </TALLYMESSAGE>`)
  }

  await logExport(supabase, user.id, 'sales_vouchers', from, to)

  return wrapEnvelope(STORE.name, 'Vouchers', messages.join('\n'))
}

// ── Purchase Vouchers ──────────────────────────────────────────────────────

export async function exportPurchaseVouchersXML(from: string, to: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ledgerMap = await fetchLedgerMap(supabase)

  const fromDate = `${from}T00:00:00.000Z`
  const toDate   = `${to}T23:59:59.999Z`

  // Use supplier_invoices if available, otherwise fall back to stock_in records
  const { data: supplierInvoices, error: siErr } = await supabase
    .from('supplier_invoices')
    .select('*, stock_in(*, products(name, sku, hsn_code, gst_rate))')
    .gte('purchase_date', from)
    .lte('purchase_date', to)
    .order('purchase_date', { ascending: true })

  if (siErr) throw new Error(siErr.message)

  const supplierLedger  = ledgerMap['supplier_ledger'] ?? 'Sundry Creditors'
  const purchaseLedger  = 'Purchase Accounts'

  const messages: string[] = []

  for (const si of supplierInvoices ?? []) {
    const partyName    = si.supplier_name ? esc(si.supplier_name) : supplierLedger
    const totalAmount  = Number(si.total_amount)
    const purchaseDate = si.purchase_date

    let entries = ''

    // Party credit (positive in Tally = credit for purchase)
    entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt(totalAmount)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`

    // Purchase debit
    entries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(purchaseLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amt(totalAmount)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`

    const voucherNo = si.purchase_invoice_no
      ? esc(si.purchase_invoice_no)
      : `PUR-${si.id.slice(0, 8).toUpperCase()}`

    messages.push(`
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>${tallyDate(purchaseDate)}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>${entries}
          </VOUCHER>
        </TALLYMESSAGE>`)
  }

  await logExport(supabase, user.id, 'purchase_vouchers', from, to)

  return wrapEnvelope(STORE.name, 'Vouchers', messages.join('\n'))
}

// ── Stock Masters ──────────────────────────────────────────────────────────

export async function exportStockMastersXML(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: products, error } = await supabase
    .from('products')
    .select('name, sku, hsn_code, gst_rate, cost_price, current_stock')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const messages: string[] = []

  for (const p of products ?? []) {
    const openingValue = Number(p.cost_price) * Number(p.current_stock)

    messages.push(`
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM ACTION="Create">
            <NAME>${esc(p.name)}</NAME>
            <BASEUNITS>Nos</BASEUNITS>
            <GSTDETAILS.LIST>
              <RATEOFDUTY>${Number(p.gst_rate ?? 0)}</RATEOFDUTY>
              <TAXTYPE>GST</TAXTYPE>
            </GSTDETAILS.LIST>
            ${p.hsn_code ? `<HSN>${esc(p.hsn_code)}</HSN>` : ''}
            <OPENINGBALANCE>${Number(p.current_stock)}</OPENINGBALANCE>
            <OPENINGRATE>${amt(Number(p.cost_price))}/Nos</OPENINGRATE>
            <OPENINGVALUE>${amt(openingValue)}</OPENINGVALUE>
          </STOCKITEM>
        </TALLYMESSAGE>`)
  }

  await logExport(supabase, user.id, 'stock_masters', null, null)

  return wrapEnvelope(STORE.name, 'Stock Items', messages.join('\n'))
}

// ── Ledger Masters ─────────────────────────────────────────────────────────

export async function exportLedgerMastersXML(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [customersRes, suppliersRes] = await Promise.all([
    supabase
      .from('customers')
      .select('name, gstin, address, state')
      .order('name', { ascending: true }),
    supabase
      .from('suppliers')
      .select('name, gstin, address, state')
      .order('name', { ascending: true }),
  ])

  if (customersRes.error) throw new Error(customersRes.error.message)
  if (suppliersRes.error) throw new Error(suppliersRes.error.message)

  const messages: string[] = []

  for (const c of customersRes.data ?? []) {
    messages.push(`
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER ACTION="Create">
            <NAME>${esc(c.name)}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            ${c.gstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${esc(c.gstin)}</PARTYGSTIN>` : ''}
            ${c.address ? `<ADDRESS.LIST><ADDRESS>${esc(c.address)}</ADDRESS></ADDRESS.LIST>` : ''}
            ${c.state ? `<STATENAME>${esc(c.state)}</STATENAME>` : ''}
          </LEDGER>
        </TALLYMESSAGE>`)
  }

  for (const s of suppliersRes.data ?? []) {
    messages.push(`
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER ACTION="Create">
            <NAME>${esc(s.name)}</NAME>
            <PARENT>Sundry Creditors</PARENT>
            ${s.gstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${esc(s.gstin)}</PARTYGSTIN>` : ''}
            ${s.address ? `<ADDRESS.LIST><ADDRESS>${esc(s.address)}</ADDRESS></ADDRESS.LIST>` : ''}
            ${s.state ? `<STATENAME>${esc(s.state)}</STATENAME>` : ''}
          </LEDGER>
        </TALLYMESSAGE>`)
  }

  await logExport(supabase, user.id, 'ledger_masters', null, null)

  return wrapEnvelope(STORE.name, 'Ledger', messages.join('\n'))
}

// ── Export History ─────────────────────────────────────────────────────────

export interface ExportLogRow {
  id: string
  export_type: string
  date_from: string | null
  date_to: string | null
  created_at: string
}

export async function getExportLogs(): Promise<ExportLogRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('export_logs')
    .select('id, export_type, date_from, date_to, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return (data ?? []) as ExportLogRow[]
}
