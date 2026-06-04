'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupplierInvoice } from '@/types/database'
import { Resend } from 'resend'

export async function getSupplierDueStats() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('id, total_amount, payment_status')
    .in('payment_status', ['pending', 'partial'])
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    dueCount: rows.length,
    totalDue: rows.reduce((sum, r) => sum + Number(r.total_amount), 0),
  }
}

export async function getRecentDueSupplierInvoices() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('id, purchase_invoice_no, supplier_name, purchase_date, total_amount, payment_status')
    .in('payment_status', ['pending', 'partial'])
    .order('purchase_date', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    purchase_invoice_no: string | null
    supplier_name: string | null
    purchase_date: string
    total_amount: number
    payment_status: string
  }>
}

export async function getSupplierInvoicesByName(supplierName: string): Promise<SupplierInvoice[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('*, supplier_payments(id, amount, payment_date, payment_method, notes)')
    .eq('supplier_name', supplierName)
    .order('purchase_date', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SupplierInvoice[]
}

export async function getSupplierInvoices(): Promise<SupplierInvoice[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(`
      *,
      supplier_payments(id, amount, payment_date, payment_reference, payment_method, notes, created_at),
      stock_in(id, product_id, quantity, cost_price, products(id, name, sku))
    `)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SupplierInvoice[]
}

export async function getSupplierInvoice(id: string): Promise<SupplierInvoice | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(`
      *,
      supplier_payments(id, amount, payment_date, payment_reference, payment_method, notes, created_at),
      stock_in(id, product_id, quantity, cost_price, notes, products(id, name, sku))
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as SupplierInvoice
}

export async function recomputePaymentStatus(invoiceId: string): Promise<void> {
  const supabase = await createClient()

  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from('supplier_invoices').select('total_amount').eq('id', invoiceId).single(),
    supabase.from('supplier_payments').select('amount').eq('supplier_invoice_id', invoiceId),
  ])

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalAmount = Number(invoice?.total_amount ?? 0)

  const payment_status =
    totalPaid <= 0 ? 'pending' : totalPaid >= totalAmount ? 'paid' : 'partial'

  await supabase
    .from('supplier_invoices')
    .update({ payment_status })
    .eq('id', invoiceId)

  revalidatePath('/stock-in')
  revalidatePath(`/stock-in/${invoiceId}`)
}

export async function deleteSupplierInvoice(id: string): Promise<void> {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Fetch invoice with stock_in items
  const { data: invoice, error: fetchError } = await supabase
    .from('supplier_invoices')
    .select('*, stock_in(id, product_id, quantity)')
    .eq('id', id)
    .single()

  if (fetchError || !invoice) throw new Error(fetchError?.message ?? 'Invoice not found')

  const stockInRows = (invoice.stock_in ?? []) as Array<{ id: string; product_id: string; quantity: number }>

  // Reverse stock for each stock_in row
  for (const row of stockInRows) {
    const { data: product, error: productFetchError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', row.product_id)
      .single()
    if (productFetchError) throw new Error(`Failed to fetch product: ${productFetchError.message}`)

    const newStock = Math.max(0, (product?.current_stock ?? 0) - row.quantity)
    const { error: stockUpdateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', row.product_id)
    if (stockUpdateError) throw new Error(`Failed to reverse stock: ${stockUpdateError.message}`)
  }

  // Delete stock_in rows
  const { error: stockInDeleteError } = await supabase
    .from('stock_in')
    .delete()
    .eq('supplier_invoice_id', id)
  if (stockInDeleteError) throw new Error(stockInDeleteError.message)

  // Delete payments
  const { error: paymentsDeleteError } = await supabase
    .from('supplier_payments')
    .delete()
    .eq('supplier_invoice_id', id)
  if (paymentsDeleteError) throw new Error(paymentsDeleteError.message)

  // Delete invoice
  const { error: invoiceDeleteError } = await supabase
    .from('supplier_invoices')
    .delete()
    .eq('id', id)
  if (invoiceDeleteError) throw new Error(invoiceDeleteError.message)

  // Send email notification (non-blocking)
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const itemsCount = stockInRows.length
    const invNo = invoice.purchase_invoice_no ?? 'Unknown'
    await resend.emails.send({
      from: 'DS POS <onboarding@resend.dev>',
      to: 'hussamroll@gmail.com',
      subject: `Supplier Invoice Deleted: ${invNo}`,
      html: `
        <h2 style="font-family:sans-serif;color:#0F172A;">Supplier Invoice Deleted</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:480px;">
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Invoice No</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${invNo}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Supplier</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${invoice.supplier_name ?? '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Date</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${invoice.purchase_date}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Total Amount</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">₹${Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Items</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${itemsCount} item${itemsCount !== 1 ? 's' : ''}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0;">Deleted By</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${user.email ?? user.id}</td>
          </tr>
        </table>
        <p style="font-family:sans-serif;font-size:12px;color:#64748b;margin-top:16px;">Stock has been reversed for all ${itemsCount} item${itemsCount !== 1 ? 's' : ''} in this invoice.</p>
      `,
    })
  } catch (emailErr) {
    console.error('Failed to send delete notification email:', emailErr)
  }

  revalidatePath('/stock-in')
  revalidatePath('/products')
}

export interface LedgerTransaction {
  id: string
  date: string
  type: 'invoice' | 'payment'
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
}

export interface SupplierLedger {
  supplier_id: string
  supplier_name: string
  transactions: LedgerTransaction[]
  total_invoiced: number
  total_paid: number
  closing_balance: number
}

export async function getSupplierLedger(supplierId: string): Promise<SupplierLedger> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('id', supplierId)
    .single()

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('*, supplier_payments(*)')
    .eq('supplier_id', supplierId)
    .order('purchase_date', { ascending: true })

  const rows: LedgerTransaction[] = []

  for (const inv of (invoices ?? [])) {
    rows.push({
      id: inv.id,
      date: inv.purchase_date,
      type: 'invoice',
      reference: inv.purchase_invoice_no ?? inv.id.slice(0, 8),
      description: 'Invoice received',
      debit: Number(inv.total_amount),
      credit: 0,
      balance: 0,
    })
    for (const pmt of (inv.supplier_payments ?? [])) {
      rows.push({
        id: pmt.id,
        date: pmt.payment_date,
        type: 'payment',
        reference: pmt.payment_reference ?? '—',
        description: `Payment (${pmt.payment_method ?? ''})`,
        debit: 0,
        credit: Number(pmt.amount),
        balance: 0,
      })
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))

  let runningBalance = 0
  for (const row of rows) {
    runningBalance += row.debit - row.credit
    row.balance = runningBalance
  }

  const total_invoiced = rows.filter(r => r.type === 'invoice').reduce((s, r) => s + r.debit, 0)
  const total_paid = rows.filter(r => r.type === 'payment').reduce((s, r) => s + r.credit, 0)

  return {
    supplier_id: supplierId,
    supplier_name: supplier?.name ?? 'Unknown',
    transactions: rows,
    total_invoiced,
    total_paid,
    closing_balance: total_invoiced - total_paid,
  }
}

export interface PayableAging {
  supplier_id: string | null
  supplier_name: string
  current: number
  days_31_60: number
  days_61_90: number
  over_90: number
  total_due: number
}

export async function getPayablesAging(): Promise<PayableAging[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('*, supplier_payments(*)')
    .neq('payment_status', 'paid')
    .order('purchase_date', { ascending: true })

  const today = new Date()
  const bySupplier: Record<string, PayableAging> = {}

  for (const inv of (invoices ?? [])) {
    const key = inv.supplier_name ?? 'Unknown'
    if (!bySupplier[key]) {
      bySupplier[key] = { supplier_id: inv.supplier_id ?? null, supplier_name: key, current: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total_due: 0 }
    }
    const paid = ((inv.supplier_payments ?? []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0)
    const outstanding = Number(inv.total_amount) - paid
    if (outstanding <= 0) continue

    const refDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.purchase_date)
    const ageDays = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))
    const entry = bySupplier[key]
    if (ageDays <= 30) entry.current += outstanding
    else if (ageDays <= 60) entry.days_31_60 += outstanding
    else if (ageDays <= 90) entry.days_61_90 += outstanding
    else entry.over_90 += outstanding
    entry.total_due += outstanding
  }

  return Object.values(bySupplier).filter(s => s.total_due > 0).sort((a, b) => b.total_due - a.total_due)
}
