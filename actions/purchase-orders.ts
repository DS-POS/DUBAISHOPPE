'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PurchaseOrder, POStatus } from '@/types/database'

export interface POLineInput {
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
}

export interface CreatePOData {
  supplier_id: string | null
  supplier_name: string
  expected_date?: string
  notes?: string
  items: POLineInput[]
}

export async function createPurchaseOrder(data: CreatePOData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.items.length === 0) throw new Error('Add at least one item to the PO.')
  if (!data.supplier_name.trim()) throw new Error('Supplier name is required.')

  const { data: poNoRow, error: seqErr } = await supabase.rpc('next_po_no')
  if (seqErr || !poNoRow) throw new Error('Failed to generate PO number.')

  const total_amount = data.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0)

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      po_no: String(poNoRow),
      supplier_id: data.supplier_id,
      supplier_name: data.supplier_name,
      status: 'draft',
      expected_date: data.expected_date ?? null,
      notes: data.notes ?? null,
      total_amount,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (poErr) throw new Error(poErr.message)

  const { error: itemsErr } = await supabase.from('purchase_order_items').insert(
    data.items.map(item => ({
      po_id: po.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
    }))
  )
  if (itemsErr) throw new Error(itemsErr.message)

  revalidatePath('/purchase-orders')
  return po.id
}

export async function getPurchaseOrders(): Promise<(PurchaseOrder & {
  suppliers: { name: string } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getPurchaseOrder(id: string): Promise<(PurchaseOrder & {
  suppliers: { id: string; name: string; phone: string | null; email: string | null } | null
  purchase_order_items: Array<{ id: string; product_id: string | null; product_name: string; sku: string | null; quantity_ordered: number; unit_cost: number; total_cost: number }>
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(id, name, phone, email), purchase_order_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function updatePOStatus(id: string, status: POStatus): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single()
  if (!po) throw new Error('PO not found')
  if (po.status === 'received') throw new Error('Cannot change status of a received PO.')
  if (po.status === 'cancelled' && status !== 'draft') throw new Error('Cannot reactivate a cancelled PO.')

  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/purchase-orders')
  revalidatePath(`/purchase-orders/${id}`)
}

export async function receivePurchaseOrder(id: string, purchase_invoice_no: string, purchase_date: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', id)
    .single()
  if (poErr || !po) throw new Error('PO not found')
  if (po.status === 'received') throw new Error('PO already received.')
  if (po.status === 'cancelled') throw new Error('Cannot receive a cancelled PO.')

  const items = (po.purchase_order_items as Array<{
    product_id: string | null; product_name: string; sku: string | null; quantity_ordered: number; unit_cost: number
  }>)

  const { data: supplierInv, error: siErr } = await supabase
    .from('supplier_invoices')
    .insert({
      purchase_invoice_no,
      supplier_name: po.supplier_name,
      supplier_gstin: null,
      purchase_date,
      total_amount: po.total_amount,
      payment_status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (siErr) throw new Error(siErr.message)

  for (const item of items) {
    if (!item.product_id) continue
    const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single()
    if (!product) continue

    await supabase.from('stock_in').insert({
      product_id: item.product_id,
      quantity: item.quantity_ordered,
      cost_price: item.unit_cost,
      supplier_name: po.supplier_name,
      purchase_invoice_no,
      purchase_date,
      supplier_invoice_id: supplierInv.id,
      created_by: user.id,
    })

    await supabase
      .from('products')
      .update({ current_stock: product.current_stock + item.quantity_ordered })
      .eq('id', item.product_id)
  }

  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'received' })
    .eq('id', id)
  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/purchase-orders')
  revalidatePath(`/purchase-orders/${id}`)
  revalidatePath('/stock-in')
  revalidatePath('/products')
}
