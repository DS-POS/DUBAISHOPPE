'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SalesReturn, SalesReturnItem, ReturnRefundMethod } from '@/types/database'
import { calculateLineGST } from '@/lib/gst'

export interface ReturnLineInput {
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  quantity_returned: number
  rate: number
  discount: number
  gst_rate: number
  customer_state: string
}

export interface CreateSalesReturnData {
  invoice_id: string
  reason: string
  refund_method: ReturnRefundMethod
  notes?: string
  items: ReturnLineInput[]
}

export async function createSalesReturn(data: CreateSalesReturnData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.items.length === 0) throw new Error('Select at least one item to return.')

  // 1. Verify invoice exists and is not cancelled
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, status, invoice_items(*)')
    .eq('id', data.invoice_id)
    .single()
  if (invErr || !invoice) throw new Error('Invoice not found')
  if (invoice.status === 'cancelled') throw new Error('Cannot return against a cancelled invoice.')

  // 2. Validate quantities — cannot exceed original quantity minus already-returned qty
  for (const item of data.items) {
    const originalItem = (invoice.invoice_items as Array<{ id: string; quantity: number }>)
      .find(i => i.id === item.invoice_item_id)
    if (!originalItem) throw new Error(`Invoice item ${item.invoice_item_id} not found on invoice.`)
    if (item.quantity_returned <= 0) throw new Error('Return quantity must be greater than 0.')
    if (item.quantity_returned > originalItem.quantity) {
      throw new Error(`Cannot return more than ${originalItem.quantity} units of "${item.product_name}".`)
    }

    // Check already-returned qty for this invoice item
    const { data: priorReturns } = await supabase
      .from('sales_return_items')
      .select('quantity_returned')
      .eq('invoice_item_id', item.invoice_item_id)
    const alreadyReturned = (priorReturns ?? []).reduce((s, r) => s + r.quantity_returned, 0)
    const maxReturnable = originalItem.quantity - alreadyReturned
    if (item.quantity_returned > maxReturnable) {
      throw new Error(
        `Only ${maxReturnable} units of "${item.product_name}" can still be returned (${alreadyReturned} already returned).`
      )
    }
  }

  // 3. Get return number
  const { data: returnNoRow, error: seqErr } = await supabase.rpc('next_return_no')
  if (seqErr || !returnNoRow) throw new Error('Failed to generate return number.')

  // 4. Calculate GST per line item
  // discount on invoice items is stored as total discount for that line; pass it directly
  const returnItems = data.items.map(item => {
    const gst = calculateLineGST(
      {
        rate: item.rate,
        quantity: item.quantity_returned,
        discount: item.discount,
        gst_rate: item.gst_rate,
      },
      item.customer_state
    )
    return { ...item, ...gst }
  })
  const total_refund = returnItems.reduce((s, i) => s + i.total, 0)

  // 5. Insert return header
  const { data: ret, error: retErr } = await supabase
    .from('sales_returns')
    .insert({
      return_no: String(returnNoRow),
      invoice_id: data.invoice_id,
      reason: data.reason,
      refund_method: data.refund_method,
      total_refund,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (retErr) throw new Error(retErr.message)

  // 6. Insert return items
  const { error: itemsErr } = await supabase.from('sales_return_items').insert(
    returnItems.map(item => ({
      return_id: ret.id,
      invoice_item_id: item.invoice_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      serial_number: item.serial_number,
      quantity_returned: item.quantity_returned,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
      taxable_amount: item.taxable_amount,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      total: item.total,
    }))
  )
  if (itemsErr) throw new Error(itemsErr.message)

  // 7. Restore stock for each product
  for (const item of returnItems) {
    if (!item.product_id) continue
    const { data: product } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .single()
    if (product) {
      await supabase
        .from('products')
        .update({ current_stock: product.current_stock + item.quantity_returned })
        .eq('id', item.product_id)
    }
    // Restore serial if applicable
    if (item.serial_number) {
      await supabase
        .from('product_serials')
        .update({ status: 'returned' })
        .eq('serial_number', item.serial_number)
        .eq('product_id', item.product_id)
    }
  }

  revalidatePath('/returns')
  revalidatePath(`/invoices/${data.invoice_id}`)
  return ret.id
}

export async function getSalesReturns(limit = 100): Promise<(SalesReturn & {
  invoices: { invoice_no: string; grand_total: number } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales_returns')
    .select('*, invoices(invoice_no, grand_total)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getSalesReturn(id: string): Promise<(SalesReturn & {
  invoices: {
    id: string
    invoice_no: string
    grand_total: number
    customers: { name: string; state: string } | null
  } | null
  sales_return_items: SalesReturnItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales_returns')
    .select('*, invoices(id, invoice_no, grand_total, customers(name, state)), sales_return_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function getReturnableItems(invoiceId: string): Promise<Array<{
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  original_qty: number
  already_returned: number
  returnable_qty: number
  rate: number
  discount: number
  gst_rate: number
}>> {
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('invoice_items(*)')
    .eq('id', invoiceId)
    .single()
  if (error || !invoice) throw new Error('Invoice not found')

  const items = invoice.invoice_items as Array<{
    id: string
    product_id: string | null
    product_name: string
    sku: string | null
    serial_number: string | null
    quantity: number
    rate: number
    discount: number
    gst_rate: number
  }>

  const result = []
  for (const item of items) {
    const { data: priorReturns } = await supabase
      .from('sales_return_items')
      .select('quantity_returned')
      .eq('invoice_item_id', item.id)
    const alreadyReturned = (priorReturns ?? []).reduce((s, r) => s + r.quantity_returned, 0)
    const returnable_qty = item.quantity - alreadyReturned
    result.push({
      invoice_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      serial_number: item.serial_number,
      original_qty: item.quantity,
      already_returned: alreadyReturned,
      returnable_qty,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
    })
  }
  return result.filter(i => i.returnable_qty > 0)
}
