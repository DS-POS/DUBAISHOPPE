'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProductImportRow {
  name: string
  sku: string
  category_name?: string
  brand?: string
  cost_price: number
  selling_price?: number
  gst_rate?: number
  hsn_code?: string
  low_stock_alert?: number
  opening_stock?: number
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; sku: string; message: string }>
}

export async function bulkImportProducts(
  rows: ProductImportRow[],
  conflictMode: 'skip' | 'update'
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id,name')
  const categoryMap: Record<string, string> = {}
  for (const cat of categoriesData ?? []) {
    categoryMap[cat.name.toLowerCase()] = cat.id
  }

  const { data: existingSkuData } = await supabase
    .from('products')
    .select('sku')
  const existingSkus = new Set((existingSkuData ?? []).map((r: { sku: string }) => r.sku))

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: ImportResult['errors'] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    if (!row.name?.trim()) {
      errors.push({ row: rowNum, sku: row.sku ?? '', message: 'Name is required' })
      continue
    }
    if (!row.sku?.trim()) {
      errors.push({ row: rowNum, sku: '', message: 'SKU is required' })
      continue
    }
    if (!row.cost_price || row.cost_price <= 0) {
      errors.push({ row: rowNum, sku: row.sku, message: 'cost_price must be greater than 0' })
      continue
    }

    if (existingSkus.has(row.sku)) {
      if (conflictMode === 'skip') {
        skipped++
        continue
      }
      const { error } = await supabase
        .from('products')
        .update({
          cost_price: row.cost_price,
          selling_price: row.selling_price ?? row.cost_price * 1.2,
          gst_rate: row.gst_rate ?? 18,
          brand: row.brand ?? null,
          hsn_code: row.hsn_code ?? null,
          low_stock_alert: row.low_stock_alert ?? 5,
          updated_at: new Date().toISOString(),
        })
        .eq('sku', row.sku)
      if (error) {
        errors.push({ row: rowNum, sku: row.sku, message: error.message })
      } else {
        updated++
      }
      continue
    }

    const { error } = await supabase.from('products').insert({
      name: row.name,
      sku: row.sku,
      barcode: row.sku,
      category_id: categoryMap[row.category_name?.toLowerCase() ?? ''] ?? null,
      brand: row.brand ?? null,
      cost_price: row.cost_price,
      selling_price: row.selling_price ?? row.cost_price * 1.2,
      gst_rate: row.gst_rate ?? 18,
      hsn_code: row.hsn_code ?? null,
      low_stock_alert: row.low_stock_alert ?? 5,
      serial_required: false,
      status: 'active',
      current_stock: row.opening_stock ?? 0,
    })
    if (error) {
      errors.push({ row: rowNum, sku: row.sku, message: error.message })
    } else {
      created++
    }
  }

  revalidatePath('/products')
  return { created, updated, skipped, errors }
}
