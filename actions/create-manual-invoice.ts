'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export interface ManualInvoiceItem {
  product_id: string
  quantity: number
  cost_price: number
}

export interface CreateManualInvoicePayload {
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date: string
  items: ManualInvoiceItem[]
}

export async function createManualInvoice(payload: CreateManualInvoicePayload): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (payload.items.length === 0) throw new Error('Add at least one item.')

  const total_amount = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.cost_price,
    0
  )

  const { data: invoice, error: invoiceError } = await supabase
    .from('supplier_invoices')
    .insert({
      purchase_invoice_no: payload.purchase_invoice_no || null,
      supplier_name: payload.supplier_name || null,
      supplier_gstin: payload.supplier_gstin || null,
      purchase_date: payload.purchase_date,
      total_amount,
      payment_status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError) throw new Error(invoiceError.message)

  const stockInRows = payload.items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    cost_price: item.cost_price,
    supplier_name: payload.supplier_name || null,
    supplier_gstin: payload.supplier_gstin || null,
    purchase_invoice_no: payload.purchase_invoice_no || null,
    purchase_date: payload.purchase_date,
    supplier_invoice_id: invoice.id,
    created_by: user.id,
  }))

  const { error: stockError } = await supabase.from('stock_in').insert(stockInRows)
  if (stockError) throw new Error(stockError.message)

  revalidatePath('/stock-in')
  revalidatePath('/products')
  redirect('/stock-in/' + invoice.id)
}
