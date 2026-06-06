'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StockAdjustment, StockAdjustmentType } from '@/types/database'

export interface CreateAdjustmentData {
  product_id: string
  adjustment_type: StockAdjustmentType
  quantity: number
  notes: string | null
}

export async function createStockAdjustment(data: CreateAdjustmentData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.quantity === 0) throw new Error('Quantity cannot be zero')

  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, current_stock, name')
    .eq('id', data.product_id)
    .single()
  if (pErr || !product) throw new Error('Product not found')

  const newStock = product.current_stock + data.quantity
  if (newStock < 0) throw new Error(`Cannot reduce stock below 0. Current: ${product.current_stock}`)

  const { error: adjErr } = await supabase.from('stock_adjustments').insert({
    product_id: data.product_id,
    adjustment_type: data.adjustment_type,
    quantity: data.quantity,
    notes: data.notes,
    created_by: user.id,
  })
  if (adjErr) throw new Error(adjErr.message)

  const { error: stockErr } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', data.product_id)
  if (stockErr) throw new Error(stockErr.message)

  revalidatePath('/stock-adjustments')
  revalidatePath('/products')
}

export async function deleteStockAdjustment(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: adj } = await supabase
    .from('stock_adjustments')
    .select('product_id, quantity')
    .eq('id', id)
    .single()

  if (adj?.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', adj.product_id)
      .single()
    if (product) {
      await supabase
        .from('products')
        .update({ current_stock: Math.max(0, product.current_stock - adj.quantity) })
        .eq('id', adj.product_id)
    }
  }

  const { error } = await supabase.from('stock_adjustments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/stock-adjustments')
  revalidatePath('/products')
}

export async function getStockAdjustments(limit = 200): Promise<(StockAdjustment & {
  products: { id: string; name: string; sku: string; current_stock: number } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*, products(id, name, sku, current_stock)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}
