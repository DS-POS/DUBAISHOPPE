'use server'

// SETUP REQUIRED: Create 'product-images' bucket in Supabase Dashboard
// Storage → New Bucket → Name: product-images → Public: ON

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Category, Product } from '@/types/database'

export interface ProductFormData {
  name: string
  sku: string
  barcode?: string
  category_id?: string
  brand?: string
  cost_price: number
  selling_price: number
  gst_rate: number
  hsn_code?: string
  low_stock_alert: number
  opening_stock?: number
  serial_required: boolean
  is_taxable: boolean
  status: 'active' | 'inactive'
  image_url?: string
}

export async function getProducts(params?: {
  search?: string
  categoryId?: string
  status?: 'active' | 'inactive'
}): Promise<Product[]> {
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*, categories(id, name, created_at)')
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }
  if (params?.categoryId) {
    query = query.eq('category_id', params.categoryId)
  }
  if (params?.search) {
    query = query.or(
      `name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.ilike.%${params.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Product[]
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(id, name, created_at)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Product
}

export async function createProduct(formData: ProductFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // If no barcode, use SKU as barcode value
  const barcode = formData.barcode?.trim() || formData.sku

  const { error } = await supabase.from('products').insert({
    name: formData.name,
    sku: formData.sku,
    barcode,
    category_id: formData.category_id || null,
    brand: formData.brand || null,
    cost_price: formData.cost_price,
    selling_price: formData.selling_price,
    gst_rate: formData.gst_rate,
    hsn_code: formData.hsn_code || null,
    low_stock_alert: formData.low_stock_alert,
    serial_required: formData.serial_required,
    is_taxable: formData.is_taxable,
    status: formData.status,
    image_url: formData.image_url || null,
    current_stock: formData.opening_stock ?? 0,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  redirect('/products')
}

export async function updateProduct(id: string, formData: ProductFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const barcode = formData.barcode?.trim() || formData.sku

  const { error } = await supabase
    .from('products')
    .update({
      name: formData.name,
      sku: formData.sku,
      barcode,
      category_id: formData.category_id || null,
      brand: formData.brand || null,
      cost_price: formData.cost_price,
      selling_price: formData.selling_price,
      gst_rate: formData.gst_rate,
      hsn_code: formData.hsn_code || null,
      low_stock_alert: formData.low_stock_alert,
      serial_required: formData.serial_required,
      is_taxable: formData.is_taxable,
      status: formData.status,
      image_url: formData.image_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  redirect('/products')
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Category[]
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Soft delete: set status to inactive (admin only — caller must enforce role)
  const { error } = await supabase
    .from('products')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
}

export async function getLowStockProducts(): Promise<Array<{
  id: string
  name: string
  sku: string
  current_stock: number
  low_stock_alert: number
  categories: { name: string } | null
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, current_stock, low_stock_alert, categories(name)')
    .eq('status', 'active')
    .gt('low_stock_alert', 0)
    .order('current_stock', { ascending: true })

  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as unknown as Array<{
    id: string; name: string; sku: string; current_stock: number
    low_stock_alert: number; categories: { name: string } | null
  }>).filter(p => p.current_stock < p.low_stock_alert)
}
