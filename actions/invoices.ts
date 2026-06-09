'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Invoice, InvoiceItem } from '@/types/database'

export interface CreateInvoiceItem {
  product_id: string
  product_name: string
  sku: string | null
  hsn_code: string | null
  serial_number: string | null
  quantity: number
  rate: number
  discount: number
  gst_rate: number
  is_taxable: boolean
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface CreateInvoiceData {
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit' | 'insurance'
  amount_paid?: number
  payment_reference?: string
  insurance_company?: string
  insurance_claim_no?: string
  items: CreateInvoiceItem[]
}

type SupabaseInstance = Awaited<ReturnType<typeof createClient>>

function sumItems(items: CreateInvoiceItem[]) {
  return {
    subtotal: items.reduce((s, i) => s + i.rate * i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discount, 0),
    taxable_amount: items.reduce((s, i) => s + i.taxable_amount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    total_gst: items.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
    grand_total: items.reduce((s, i) => s + i.total, 0),
  }
}

async function insertOneInvoice(
  supabase: SupabaseInstance,
  userId: string,
  params: {
    invoice_no: string
    invoice_type: 'tax_invoice' | 'bill_of_supply'
    order_group_id: string | null
    customer_id: string | null
    subtotal: number
    discount: number
    taxable_amount: number
    cgst: number
    sgst: number
    igst: number
    total_gst: number
    grand_total: number
    payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit' | 'insurance'
    amount_paid?: number
    payment_reference?: string
    insurance_company?: string
    insurance_claim_no?: string
    items: CreateInvoiceItem[]
  }
): Promise<string> {
  const amountPaid = params.amount_paid ?? params.grand_total

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      invoice_no: params.invoice_no,
      invoice_type: params.invoice_type,
      order_group_id: params.order_group_id,
      customer_id: params.customer_id,
      subtotal: params.subtotal,
      discount: params.discount,
      taxable_amount: params.taxable_amount,
      cgst: params.cgst,
      sgst: params.sgst,
      igst: params.igst,
      total_gst: params.total_gst,
      grand_total: params.grand_total,
      payment_method: params.payment_method,
      amount_paid: amountPaid,
      insurance_company: params.insurance_company ?? null,
      insurance_claim_no: params.insurance_claim_no ?? null,
      status: amountPaid >= params.grand_total ? 'paid' : 'pending',
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (amountPaid > 0) {
    await supabase.from('invoice_payments').insert({
      invoice_id: invoice.id,
      amount: amountPaid,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: params.payment_method,
      payment_reference: params.payment_reference ?? null,
      notes: 'Initial payment at invoice creation',
      created_by: userId,
    })
  }

  const { error: itemsError } = await supabase.from('invoice_items').insert(
    params.items.map(item => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      hsn_code: item.hsn_code,
      serial_number: item.serial_number,
      quantity: item.quantity,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
      is_taxable: item.is_taxable,
      taxable_amount: item.taxable_amount,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      total: item.total,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  return invoice.id
}

async function deductStock(
  supabase: SupabaseInstance,
  userId: string,
  items: CreateInvoiceItem[],
  invoiceId: string
) {
  for (const item of items) {
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .single()
    const newStock = (prod?.current_stock ?? 0) - item.quantity
    await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', item.product_id)

    await supabase.from('stock_history').insert({
      product_id: item.product_id,
      change_type: 'sale',
      quantity_change: -item.quantity,
      quantity_after: newStock,
      reference_id: invoiceId,
      created_by: userId,
    })

    if (item.serial_number) {
      await supabase
        .from('product_serials')
        .update({ status: 'sold', invoice_id: invoiceId })
        .eq('product_id', item.product_id)
        .eq('serial_number', item.serial_number)
    }
  }
}

// Returns array of invoice IDs: [gstInvoiceId] or [gstInvoiceId, bosInvoiceId]
// Mixed cart (taxable + non-taxable) → 2 invoices: Tax Invoice + Bill of Supply
export async function createInvoice(data: CreateInvoiceData): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Verify stock for all items
  for (const item of data.items) {
    const { data: product, error } = await supabase
      .from('products')
      .select('current_stock, name')
      .eq('id', item.product_id)
      .single()
    if (error || !product) throw new Error(`Product not found: ${item.product_id}`)
    if (product.current_stock < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${product.current_stock}, Required: ${item.quantity}`)
    }
  }

  const taxableItems = data.items.filter(i => i.is_taxable)
  const nonTaxableItems = data.items.filter(i => !i.is_taxable)
  const isMixed = taxableItems.length > 0 && nonTaxableItems.length > 0

  if (isMixed) {
    // Split: Tax Invoice (INV-) for GST items + Bill of Supply (BOS-) for non-GST items
    const orderGroupId = crypto.randomUUID()
    const gstTotals = sumItems(taxableItems)
    const bosTotals = sumItems(nonTaxableItems)

    // Sequential allocation: fill GST invoice first, overflow to BOS
    const amountPaid = data.amount_paid ?? data.grand_total
    const gstPaid = Math.min(amountPaid, gstTotals.grand_total)
    const bosPaid = Math.max(0, amountPaid - gstTotals.grand_total)

    const { data: invNoRow, error: invSeqErr } = await supabase.rpc('next_invoice_no')
    if (invSeqErr || !invNoRow) throw new Error('Invoice number generation failed')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bosNoRow, error: bosSeqErr } = await (supabase.rpc as any)('next_bos_no')
    if (bosSeqErr || !bosNoRow) throw new Error('BOS number generation failed')

    const gstId = await insertOneInvoice(supabase, user.id, {
      invoice_no: String(invNoRow),
      invoice_type: 'tax_invoice',
      order_group_id: orderGroupId,
      customer_id: data.customer_id,
      ...gstTotals,
      payment_method: data.payment_method,
      amount_paid: gstPaid,
      payment_reference: data.payment_reference,
      insurance_company: data.insurance_company,
      insurance_claim_no: data.insurance_claim_no,
      items: taxableItems,
    })

    const bosId = await insertOneInvoice(supabase, user.id, {
      invoice_no: String(bosNoRow),
      invoice_type: 'bill_of_supply',
      order_group_id: orderGroupId,
      customer_id: data.customer_id,
      ...bosTotals,
      payment_method: data.payment_method,
      amount_paid: bosPaid,
      payment_reference: data.payment_reference,
      insurance_company: data.insurance_company,
      insurance_claim_no: data.insurance_claim_no,
      items: nonTaxableItems,
    })

    await deductStock(supabase, user.id, taxableItems, gstId)
    await deductStock(supabase, user.id, nonTaxableItems, bosId)

    revalidatePath('/invoices')
    revalidatePath('/products')
    revalidatePath('/stock-in')
    revalidatePath('/dashboard')
    return [gstId, bosId]
  }

  // Single invoice — all taxable (Tax Invoice) or all non-taxable (Bill of Supply)
  const allNonTaxable = taxableItems.length === 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcFn = allNonTaxable ? (supabase.rpc as any)('next_bos_no') : supabase.rpc('next_invoice_no')
  const { data: invoiceNoRow, error: seqError } = await rpcFn
  if (seqError) throw new Error(`Invoice number generation failed: ${seqError.message}`)
  if (!invoiceNoRow) throw new Error('Invoice number generation returned empty value')

  const invoiceId = await insertOneInvoice(supabase, user.id, {
    invoice_no: String(invoiceNoRow),
    invoice_type: allNonTaxable ? 'bill_of_supply' : 'tax_invoice',
    order_group_id: null,
    customer_id: data.customer_id,
    subtotal: data.subtotal,
    discount: data.discount,
    taxable_amount: data.taxable_amount,
    cgst: data.cgst,
    sgst: data.sgst,
    igst: data.igst,
    total_gst: data.total_gst,
    grand_total: data.grand_total,
    payment_method: data.payment_method,
    amount_paid: data.amount_paid,
    payment_reference: data.payment_reference,
    insurance_company: data.insurance_company,
    insurance_claim_no: data.insurance_claim_no,
    items: data.items,
  })

  await deductStock(supabase, user.id, data.items, invoiceId)

  revalidatePath('/invoices')
  revalidatePath('/products')
  revalidatePath('/stock-in')
  revalidatePath('/dashboard')
  return [invoiceId]
}

export async function getInvoices(params?: {
  limit?: number
  status?: string
}): Promise<(Invoice & { customers: { name: string } | null })[]> {
  const supabase = await createClient()
  let query = supabase
    .from('invoices')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 100)

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as (Invoice & { customers: { name: string } | null })[]
}

export async function getAllInvoices(): Promise<(Invoice & {
  customers: { name: string; phone: string | null } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(name, phone)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getInvoice(id: string): Promise<(Invoice & {
  customers: { name: string; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string } | null
  invoice_items: InvoiceItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(*), invoice_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function getInvoiceStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('invoices')
    .select('grand_total, amount_paid, status, created_at')
    .neq('status', 'cancelled')

  if (error) throw new Error(error.message)

  const invoices = data ?? []
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const totalRevenue = invoices.reduce((sum, i) => sum + Number(i.grand_total), 0)
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.amount_paid), 0)
  const totalDue = totalRevenue - totalPaid
  const dueInvoices = invoices.filter(i => i.status === 'pending')
  const todayInvoices = invoices.filter(i => i.created_at.startsWith(todayStr))
  const todayRevenue = todayInvoices.reduce((sum, i) => sum + Number(i.grand_total), 0)

  return {
    totalRevenue,
    totalPaid,
    totalDue,
    dueCount: dueInvoices.length,
    totalInvoices: invoices.length,
    todayRevenue,
    todayCount: todayInvoices.length,
  }
}

export async function getRecentDueInvoices() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, grand_total, amount_paid, created_at, customers(name, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as never as Array<{
    id: string
    invoice_no: string
    grand_total: number
    amount_paid: number
    created_at: string
    customers: { name: string; phone: string | null } | null
  }>
}

export async function getLinkedInvoice(orderGroupId: string, excludeId: string): Promise<(Invoice & {
  invoice_items: InvoiceItem[]
  customers: { name: string; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string } | null
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*), customers(*)')
    .eq('order_group_id', orderGroupId)
    .neq('id', excludeId)
    .single()
  if (error) return null
  return data as never
}

export async function getRecentInvoices() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, grand_total, amount_paid, status, created_at, customers(name)')
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []) as never as Array<{
    id: string
    invoice_no: string
    grand_total: number
    amount_paid: number
    status: string
    created_at: string
    customers: { name: string } | null
  }>
}

export interface DailyRevenuePoint {
  date: string
  revenue: number
  invoices: number
}

export async function getDashboardRevenueChart(days = 30): Promise<DailyRevenuePoint[]> {
  const supabase = await createClient()

  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('invoices')
    .select('grand_total, created_at')
    .gte('created_at', from.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const map = new Map<string, { revenue: number; invoices: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    map.set(d.toISOString().split('T')[0], { revenue: 0, invoices: 0 })
  }

  for (const inv of data ?? []) {
    const key = inv.created_at.split('T')[0]
    const existing = map.get(key)
    if (existing) {
      existing.revenue += Number(inv.grand_total)
      existing.invoices += 1
    }
  }

  return Array.from(map.entries()).map(([dateKey, vals]) => {
    const d = new Date(dateKey + 'T00:00:00')
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-IN', { month: 'short' })
    return { date: `${day} ${month}`, revenue: Math.round(vals.revenue * 100) / 100, invoices: vals.invoices }
  })
}

export async function deleteInvoice(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Fetch items to restore stock + serials
    const { data: items } = await supabase
      .from('invoice_items')
      .select('product_id, quantity, serial_number')
      .eq('invoice_id', id)

    // Restore stock for each product
    for (const item of items ?? []) {
      if (!item.product_id) continue
      const { data: prod } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item.product_id)
        .single()
      if (prod) {
        await supabase
          .from('products')
          .update({ current_stock: prod.current_stock + item.quantity })
          .eq('id', item.product_id)
      }
      // Restore serial status
      if (item.serial_number) {
        await supabase
          .from('product_serials')
          .update({ status: 'available', invoice_id: null })
          .eq('product_id', item.product_id)
          .eq('serial_number', item.serial_number)
      }
    }

    // Nullify quotation reference (no cascade on converted_invoice_id)
    await supabase
      .from('quotations')
      .update({ converted_invoice_id: null })
      .eq('converted_invoice_id', id)

    // Delete sales_returns (may not have cascade)
    await supabase.from('sales_returns').delete().eq('invoice_id', id)

    // Delete invoice (cascades: invoice_items, invoice_payments, customer_refunds)
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath('/customers')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete invoice' }
  }
}
