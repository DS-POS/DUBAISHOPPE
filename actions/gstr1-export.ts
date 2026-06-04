'use server'

import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceItem, Customer } from '@/types/database'

// ── types ─────────────────────────────────────────────────────────────────────

interface InvoiceRow extends Omit<Invoice, 'customers' | 'invoice_items'> {
  customers: Customer | null
  invoice_items: InvoiceItem[]
}

interface ItemDetail {
  txval: number
  rt: number
  camt: number
  samt: number
  iamt: number
}

interface B2BInvoiceEntry {
  inum: string
  idt: string
  val: number
  pos: string
  rchrg: string
  inv_typ: string
  itms: { num: number; itm_det: ItemDetail }[]
}

interface B2BEntry {
  ctin: string
  inv: B2BInvoiceEntry[]
}

interface B2CLInvoiceEntry {
  inum: string
  idt: string
  val: number
  inv_typ: string
  itms: { num: number; itm_det: ItemDetail }[]
}

interface B2CLEntry {
  pos: string
  inv: B2CLInvoiceEntry[]
}

interface B2CSEntry {
  sply_tp: string
  pos: string
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
}

interface HSNEntry {
  num: number
  hsn_sc: string
  desc: string
  uqc: string
  qty: number
  val: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

interface DocEntry {
  doc_num: number
  docs: {
    num: number
    from: string
    to: string
    totnum: number
    cancel: number
    net_issue: number
  }[]
}

interface GSTR1 {
  gstin: string
  fp: string
  gt: number
  cur_gt: number
  b2b: B2BEntry[]
  b2cl: B2CLEntry[]
  b2cs: B2CSEntry[]
  hsn: { data: HSNEntry[] }
  doc_issue: { doc_det: DocEntry[] }
}

export interface GSTR1Summary {
  b2bCount: number
  b2clCount: number
  b2csCount: number
  hsnCount: number
  totalTaxable: number
  totalCGST: number
  totalSGST: number
  totalIGST: number
  grandTotal: number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Format JS Date as DD-MM-YYYY */
function formatGSTDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** Extract first 2 digits from GSTIN as state code */
function stateCodeFromGstin(gstin: string): string {
  const code = gstin.slice(0, 2)
  return code || '96'
}

/**
 * fp = last month of the period in MMYYYY format
 * e.g. period ending 2025-06-30 → "062025"
 */
function buildFP(to: string): string {
  const d = new Date(to)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}${yyyy}`
}

// ── main export ───────────────────────────────────────────────────────────────

export async function generateGSTR1(
  from: string,
  to: string,
  gstin: string
): Promise<GSTR1> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const fromDate = `${from}T00:00:00.000Z`
  const toDate   = `${to}T23:59:59.999Z`

  const { data: rawInvoices, error } = await supabase
    .from('invoices')
    .select('*, customers(*), invoice_items(*)')
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const invoices = (rawInvoices ?? []) as unknown as InvoiceRow[]

  // ── B2B (customer has GSTIN) ────────────────────────────────────────────
  const b2bMap = new Map<string, B2BInvoiceEntry[]>()

  // ── B2CL (inter-state, no GSTIN, >2.5L) ───────────────────────────────
  const b2clMap = new Map<string, B2CLInvoiceEntry[]>()

  // ── B2CS accumulator { key: sply_tp|pos|rt } ──────────────────────────
  const b2csMap = new Map<string, { sply_tp: string; pos: string; rt: number; txval: number; iamt: number; camt: number; samt: number }>()

  // ── HSN accumulator { key: hsn_sc|rt } ────────────────────────────────
  const hsnMap = new Map<string, { hsn_sc: string; desc: string; qty: number; val: number; txval: number; iamt: number; camt: number; samt: number }>()

  let grandTotalSum = 0

  for (const inv of invoices) {
    const customer = inv.customers
    const items    = inv.invoice_items ?? []
    const hasGSTIN = !!(customer?.gstin && customer.gstin.trim().length > 0)
    const invIGST  = round2(Number(inv.igst ?? 0))
    const isInterState = invIGST > 0
    const gTotal   = round2(Number(inv.grand_total ?? 0))
    const invDate  = formatGSTDate(inv.created_at)

    grandTotalSum += gTotal

    // ── build itms list ─────────────────────────────────────────────────
    const itms = items.map((item, idx) => ({
      num: idx + 1,
      itm_det: {
        txval: round2(Number(item.taxable_amount ?? 0)),
        rt:    round2(Number(item.gst_rate ?? 0)),
        camt:  round2(Number(item.cgst ?? 0)),
        samt:  round2(Number(item.sgst ?? 0)),
        iamt:  round2(Number(item.igst ?? 0)),
      },
    }))

    if (hasGSTIN && customer?.gstin) {
      // ── B2B ────────────────────────────────────────────────────────────
      const ctin = customer.gstin.trim().toUpperCase()
      const pos  = stateCodeFromGstin(ctin)
      const entry: B2BInvoiceEntry = {
        inum:     inv.invoice_no,
        idt:      invDate,
        val:      gTotal,
        pos,
        rchrg:    'N',
        inv_typ:  'R',
        itms,
      }
      if (!b2bMap.has(ctin)) b2bMap.set(ctin, [])
      b2bMap.get(ctin)!.push(entry)
    } else if (isInterState && gTotal > 250000) {
      // ── B2CL ───────────────────────────────────────────────────────────
      const pos = '96'
      const entry: B2CLInvoiceEntry = {
        inum:    inv.invoice_no,
        idt:     invDate,
        val:     gTotal,
        inv_typ: 'R',
        itms,
      }
      if (!b2clMap.has(pos)) b2clMap.set(pos, [])
      b2clMap.get(pos)!.push(entry)
    } else {
      // ── B2CS ───────────────────────────────────────────────────────────
      for (const item of items) {
        const rt      = round2(Number(item.gst_rate ?? 0))
        const sply_tp = isInterState ? 'INTER' : 'INTRA'
        const pos     = isInterState ? '96' : '36'
        const key     = `${sply_tp}|${pos}|${rt}`

        const existing = b2csMap.get(key)
        if (existing) {
          existing.txval = round2(existing.txval + Number(item.taxable_amount ?? 0))
          existing.iamt  = round2(existing.iamt  + Number(item.igst ?? 0))
          existing.camt  = round2(existing.camt  + Number(item.cgst ?? 0))
          existing.samt  = round2(existing.samt  + Number(item.sgst ?? 0))
        } else {
          b2csMap.set(key, {
            sply_tp,
            pos,
            rt,
            txval: round2(Number(item.taxable_amount ?? 0)),
            iamt:  round2(Number(item.igst ?? 0)),
            camt:  round2(Number(item.cgst ?? 0)),
            samt:  round2(Number(item.sgst ?? 0)),
          })
        }
      }
    }

    // ── HSN summary (all invoices) ──────────────────────────────────────
    for (const item of items) {
      const hsnCode = (item.hsn_code ?? '9999').trim() || '9999'
      const rt      = round2(Number(item.gst_rate ?? 0))
      const key     = `${hsnCode}|${rt}`
      const qty     = Number(item.quantity ?? 0)
      const rate    = Number(item.rate ?? 0)

      const existing = hsnMap.get(key)
      if (existing) {
        existing.qty   += qty
        existing.val    = round2(existing.val   + rate * qty)
        existing.txval  = round2(existing.txval + Number(item.taxable_amount ?? 0))
        existing.iamt   = round2(existing.iamt  + Number(item.igst ?? 0))
        existing.camt   = round2(existing.camt  + Number(item.cgst ?? 0))
        existing.samt   = round2(existing.samt  + Number(item.sgst ?? 0))
      } else {
        hsnMap.set(key, {
          hsn_sc: hsnCode,
          desc:   item.product_name ?? '',
          qty,
          val:    round2(rate * qty),
          txval:  round2(Number(item.taxable_amount ?? 0)),
          iamt:   round2(Number(item.igst ?? 0)),
          camt:   round2(Number(item.cgst ?? 0)),
          samt:   round2(Number(item.sgst ?? 0)),
        })
      }
    }
  }

  // ── assemble B2B ──────────────────────────────────────────────────────
  const b2b: B2BEntry[] = Array.from(b2bMap.entries()).map(([ctin, inv]) => ({ ctin, inv }))

  // ── assemble B2CL ─────────────────────────────────────────────────────
  const b2cl: B2CLEntry[] = Array.from(b2clMap.entries()).map(([pos, inv]) => ({ pos, inv }))

  // ── assemble B2CS ─────────────────────────────────────────────────────
  const b2cs: B2CSEntry[] = Array.from(b2csMap.values())

  // ── assemble HSN ──────────────────────────────────────────────────────
  const hsnData: HSNEntry[] = Array.from(hsnMap.values()).map((h, idx) => ({
    num:    idx + 1,
    hsn_sc: h.hsn_sc,
    desc:   h.desc,
    uqc:    'NOS',
    qty:    round2(h.qty),
    val:    round2(h.val),
    txval:  round2(h.txval),
    iamt:   round2(h.iamt),
    camt:   round2(h.camt),
    samt:   round2(h.samt),
    csamt:  0,
  }))

  // ── doc summary ───────────────────────────────────────────────────────
  const sortedInvNos = invoices.map(i => i.invoice_no).sort()
  const totalCount   = sortedInvNos.length
  const docDet: DocEntry[] = totalCount > 0
    ? [{
        doc_num: 1,
        docs: [{
          num:       1,
          from:      sortedInvNos[0],
          to:        sortedInvNos[totalCount - 1],
          totnum:    totalCount,
          cancel:    0,
          net_issue: totalCount,
        }],
      }]
    : []

  const gt = round2(grandTotalSum)

  return {
    gstin,
    fp:  buildFP(to),
    gt,
    cur_gt: gt,
    b2b,
    b2cl,
    b2cs,
    hsn:       { data: hsnData },
    doc_issue: { doc_det: docDet },
  }
}

// ── summary helper ────────────────────────────────────────────────────────────

export async function getGSTR1Summary(
  from: string,
  to: string
): Promise<GSTR1Summary> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const fromDate = `${from}T00:00:00.000Z`
  const toDate   = `${to}T23:59:59.999Z`

  const { data: rawInvoices, error } = await supabase
    .from('invoices')
    .select('*, customers(*), invoice_items(*)')
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .neq('status', 'cancelled')

  if (error) throw new Error(error.message)

  const invoices = (rawInvoices ?? []) as unknown as InvoiceRow[]

  let b2bCount   = 0
  let b2clCount  = 0
  let b2csCount  = 0
  const hsnKeys  = new Set<string>()

  let totalTaxable = 0
  let totalCGST    = 0
  let totalSGST    = 0
  let totalIGST    = 0
  let grandTotal   = 0

  for (const inv of invoices) {
    const customer = inv.customers
    const hasGSTIN = !!(customer?.gstin && customer.gstin.trim().length > 0)
    const invIGST  = Number(inv.igst ?? 0)
    const isInterState = invIGST > 0
    const gTotal   = Number(inv.grand_total ?? 0)

    grandTotal   += gTotal
    totalTaxable += Number(inv.taxable_amount ?? 0)
    totalCGST    += Number(inv.cgst ?? 0)
    totalSGST    += Number(inv.sgst ?? 0)
    totalIGST    += invIGST

    if (hasGSTIN) {
      b2bCount++
    } else if (isInterState && gTotal > 250000) {
      b2clCount++
    } else {
      b2csCount++
    }

    for (const item of inv.invoice_items ?? []) {
      const hsnCode = (item.hsn_code ?? '9999').trim() || '9999'
      const rt      = Number(item.gst_rate ?? 0)
      hsnKeys.add(`${hsnCode}|${rt}`)
    }
  }

  return {
    b2bCount,
    b2clCount,
    b2csCount,
    hsnCount:    hsnKeys.size,
    totalTaxable: round2(totalTaxable),
    totalCGST:    round2(totalCGST),
    totalSGST:    round2(totalSGST),
    totalIGST:    round2(totalIGST),
    grandTotal:   round2(grandTotal),
  }
}
