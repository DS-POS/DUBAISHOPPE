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
  payment_method: 'cash' | 'upi' | 'card'
  amount_paid?: number
  items: CreateInvoiceItem[]
}

export async function createInvoice(data: CreateInvoiceData): Promise<string> {
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

  // 2. Get next invoice number atomically
  const { data: invoiceNoRow, error: seqError } = await supabase.rpc('next_invoice_no')
  if (seqError) throw new Error(`Invoice number generation failed: ${seqError.message}`)
  if (!invoiceNoRow) throw new Error('Invoice number generation returned empty value')
  const invoice_no: string = String(invoiceNoRow)

  // 3. Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_no,
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
      amount_paid: data.amount_paid ?? data.grand_total,
      status: (data.amount_paid ?? data.grand_total) >= data.grand_total ? 'paid' : 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (invoiceError) throw new Error(invoiceError.message)
  const invoiceId = invoice.id

  // 4. Record initial payment in invoice_payments (so recompute sums correctly)
  const initialPaid = data.amount_paid ?? data.grand_total
  if (initialPaid > 0) {
    await supabase.from('invoice_payments').insert({
      invoice_id: invoiceId,
      amount: initialPaid,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: data.payment_method,
      notes: 'Initial payment at invoice creation',
      created_by: user.id,
    })
  }

  // 5. Insert invoice items
  const itemRows = data.items.map(item => ({
    invoice_id: invoiceId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    serial_number: item.serial_number,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))
  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
  if (itemsError) throw new Error(itemsError.message)

  // 6. Deduct stock + log history + mark serials sold
  for (const item of data.items) {
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
      created_by: user.id,
    })

    if (item.serial_number) {
      await supabase
        .from('product_serials')
        .update({ status: 'sold', invoice_id: invoiceId })
        .eq('product_id', item.product_id)
        .eq('serial_number', item.serial_number)
    }
  }

  revalidatePath('/invoices')
  revalidatePath('/products')
  revalidatePath('/stock-in')
  revalidatePath('/dashboard')
  return invoiceId
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
