'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupplierInvoice } from '@/types/database'

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
