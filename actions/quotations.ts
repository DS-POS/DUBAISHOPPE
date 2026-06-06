'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createInvoice } from '@/actions/invoices'
import type { Quotation, QuotationItem, QuotationStatus } from '@/types/database'

export interface CreateQuotationItem {
  product_id: string
  product_name: string
  sku: string | null
  hsn_code: string | null
  quantity: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface CreateQuotationData {
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  valid_until: string | null
  quotation_date: string | null
  notes: string | null
  selected_bank_index: number | null
  items: CreateQuotationItem[]
}

export async function createQuotation(data: CreateQuotationData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: qRow, error: qError } = await supabase
    .from('quotations')
    .insert({
      customer_id: data.customer_id,
      subtotal: data.subtotal,
      discount: data.discount,
      taxable_amount: data.taxable_amount,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      total_gst: data.total_gst,
      grand_total: data.grand_total,
      valid_until: data.valid_until,
      quotation_date: data.quotation_date ?? new Date().toISOString().slice(0, 10),
      notes: data.notes,
      selected_bank_index: data.selected_bank_index,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (qError) throw new Error(qError.message)
  const quotationId = qRow.id

  const itemRows = data.items.map(item => ({
    quotation_id: quotationId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))
  const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows)
  if (itemsError) throw new Error(itemsError.message)

  revalidatePath('/quotations')
  return quotationId
}

export async function getAllQuotations(): Promise<(Quotation & {
  customers: { name: string } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getQuotation(id: string): Promise<(Quotation & {
  customers: { name: string; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string; business_name: string | null } | null
  quotation_items: QuotationItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('*, customers(*), quotation_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
  revalidatePath(`/quotations/${id}`)
}

export async function convertQuotationToInvoice(quotationId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const quotation = await getQuotation(quotationId)
  if (!quotation) throw new Error('Quotation not found')

  const items = (quotation.quotation_items ?? []).map(item => ({
    product_id: item.product_id ?? '',
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    serial_number: null as string | null,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    is_taxable: (item as unknown as { is_taxable?: boolean }).is_taxable ?? true,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))

  const [invoiceId] = await createInvoice({
    customer_id: quotation.customer_id,
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    taxable_amount: quotation.taxable_amount,
    cgst: quotation.cgst,
    sgst: quotation.sgst,
    igst: quotation.igst,
    total_gst: quotation.total_gst,
    grand_total: quotation.grand_total,
    payment_method: 'cash',
    amount_paid: 0,
    items,
  })

  const { error } = await supabase
    .from('quotations')
    .update({ status: 'accepted', converted_invoice_id: invoiceId })
    .eq('id', quotationId)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
  revalidatePath(`/quotations/${quotationId}`)
  revalidatePath('/invoices')
  return invoiceId
}

export async function updateQuotation(id: string, data: CreateQuotationData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: q } = await supabase.from('quotations').select('status').eq('id', id).single()
  if (!q) throw new Error('Quotation not found')
  if (q.status !== 'draft') throw new Error('Only draft quotations can be edited')

  const { error: updateError } = await supabase
    .from('quotations')
    .update({
      customer_id: data.customer_id,
      subtotal: data.subtotal,
      discount: data.discount,
      taxable_amount: data.taxable_amount,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      total_gst: data.total_gst,
      grand_total: data.grand_total,
      valid_until: data.valid_until,
      quotation_date: data.quotation_date ?? new Date().toISOString().slice(0, 10),
      notes: data.notes,
      selected_bank_index: data.selected_bank_index,
    })
    .eq('id', id)
  if (updateError) throw new Error(updateError.message)

  const { error: delError } = await supabase.from('quotation_items').delete().eq('quotation_id', id)
  if (delError) throw new Error(delError.message)

  const itemRows = data.items.map(item => ({
    quotation_id: id,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))
  const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows)
  if (itemsError) throw new Error(itemsError.message)

  revalidatePath('/quotations')
  revalidatePath(`/quotations/${id}`)
}

export async function deleteQuotation(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: q } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', id)
    .single()
  if (!q) throw new Error('Quotation not found')
  if (q.status !== 'draft') throw new Error('Only draft quotations can be deleted')

  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
}
