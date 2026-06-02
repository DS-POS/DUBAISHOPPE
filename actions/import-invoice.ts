'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ImportItem {
  description: string
  hsn_code?: string
  quantity: number
  unit_price: number
  action: 'use_existing' | 'create_new' | 'skip'
  product_id?: string          // when action === 'use_existing'
  new_product_name: string     // when action === 'create_new'
  new_product_category_id?: string
  new_product_gst_rate: number // default 18
}

export interface ImportInvoicePayload {
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date: string
  total_amount: number
  items: ImportItem[]
}

export async function importSupplierInvoice(payload: ImportInvoicePayload): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const activeItems = payload.items.filter(i => i.action !== 'skip')
  if (activeItems.length === 0) throw new Error('No items to import.')

  // 1. Create new products for items that need it
  const productIdMap = new Map<number, string>() // index → product_id

  for (let i = 0; i < activeItems.length; i++) {
    const item = activeItems[i]

    if (item.action === 'use_existing' && item.product_id) {
      productIdMap.set(i, item.product_id)
      continue
    }

    if (item.action === 'create_new') {
      const sku = `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const selling_price = Number((item.unit_price * 1.2).toFixed(2))

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: item.new_product_name,
          sku,
          barcode: sku,
          category_id: item.new_product_category_id || null,
          cost_price: item.unit_price,
          selling_price,
          gst_rate: item.new_product_gst_rate,
          hsn_code: item.hsn_code || null,
          low_stock_alert: 5,
          serial_required: false,
          status: 'active',
          current_stock: 0,
        })
        .select('id')
        .single()

      if (productError) throw new Error(`Failed to create product "${item.new_product_name}": ${productError.message}`)
      productIdMap.set(i, newProduct.id)
    }
  }

  // 2. Create supplier_invoices header
  const { data: supplierInvoice, error: invoiceError } = await supabase
    .from('supplier_invoices')
    .insert({
      purchase_invoice_no: payload.purchase_invoice_no || null,
      supplier_name: payload.supplier_name || null,
      supplier_gstin: payload.supplier_gstin || null,
      purchase_date: payload.purchase_date,
      total_amount: payload.total_amount,
      payment_status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError) throw new Error(invoiceError.message)
  const supplierInvoiceId = supplierInvoice.id

  // 3. Bulk insert stock_in rows
  const stockInRows = activeItems
    .map((item, i) => {
      const product_id = productIdMap.get(i)
      if (!product_id) return null
      return {
        product_id,
        quantity: item.quantity,
        cost_price: item.unit_price,
        supplier_name: payload.supplier_name || null,
        supplier_gstin: payload.supplier_gstin || null,
        purchase_invoice_no: payload.purchase_invoice_no || null,
        purchase_date: payload.purchase_date,
        notes: item.hsn_code ? `HSN: ${item.hsn_code}` : null,
        supplier_invoice_id: supplierInvoiceId,
        created_by: user.id,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (stockInRows.length > 0) {
    const { error: stockError } = await supabase.from('stock_in').insert(stockInRows)
    if (stockError) throw new Error(stockError.message)
  }

  revalidatePath('/stock-in')
  revalidatePath('/products')

  return supplierInvoiceId
}
