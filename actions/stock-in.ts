'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { StockIn } from '@/types/database'

export interface StockInFormData {
  product_id: string
  quantity: number
  cost_price: number
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date: string
  notes?: string
  serial_numbers?: string[]
}

export async function getStockIns(params?: {
  productId?: string
  limit?: number
}): Promise<StockIn[]> {
  const supabase = await createClient()

  let query = supabase
    .from('stock_in')
    .select('*, products(id, name, sku)')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 100)

  if (params?.productId) {
    query = query.eq('product_id', params.productId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as StockIn[]
}

export async function createStockIn(formData: StockInFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: stockInRow, error: stockInError } = await supabase
    .from('stock_in')
    .insert({
      product_id: formData.product_id,
      quantity: formData.quantity,
      cost_price: formData.cost_price,
      supplier_name: formData.supplier_name || null,
      supplier_gstin: formData.supplier_gstin || null,
      purchase_invoice_no: formData.purchase_invoice_no || null,
      purchase_date: formData.purchase_date,
      notes: formData.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (stockInError) throw new Error(stockInError.message)

  if (formData.serial_numbers && formData.serial_numbers.length > 0) {
    const serialRows = formData.serial_numbers
      .filter(s => s.trim().length > 0)
      .map(serial => ({
        product_id: formData.product_id,
        serial_number: serial.trim(),
        status: 'available' as const,
        stock_in_id: stockInRow.id,
      }))

    if (serialRows.length > 0) {
      const { error: serialError } = await supabase
        .from('product_serials')
        .insert(serialRows)
      if (serialError) throw new Error(serialError.message)
    }
  }

  revalidatePath('/stock-in')
  revalidatePath('/products')
  redirect('/stock-in')
}
