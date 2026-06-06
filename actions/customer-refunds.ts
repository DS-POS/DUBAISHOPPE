'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CustomerRefund {
  id: string
  invoice_id: string
  order_group_id: string | null
  amount: number
  method: string
  refund_date: string
  notes: string | null
  created_at: string
}

export interface RecordCustomerRefundData {
  invoice_id: string
  order_group_id?: string | null
  amount: number
  method: string
  refund_date: string
  notes?: string
}

export async function recordCustomerRefund(data: RecordCustomerRefundData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: refund, error } = await supabase
    .from('customer_refunds')
    .insert({
      invoice_id: data.invoice_id,
      order_group_id: data.order_group_id ?? null,
      amount: data.amount,
      method: data.method,
      refund_date: data.refund_date,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/invoices/${data.invoice_id}`)
  return refund.id
}

export async function getCustomerRefundsByGroup(order_group_id: string): Promise<CustomerRefund[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customer_refunds')
    .select('*')
    .eq('order_group_id', order_group_id)
    .order('created_at', { ascending: true })
  if (error) return []
  return (data ?? []) as CustomerRefund[]
}

export async function getCustomerRefundsByInvoice(invoice_id: string): Promise<CustomerRefund[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customer_refunds')
    .select('*')
    .eq('invoice_id', invoice_id)
    .is('order_group_id', null)
    .order('created_at', { ascending: true })
  if (error) return []
  return (data ?? []) as CustomerRefund[]
}

export async function deleteCustomerRefund(id: string, invoice_id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('customer_refunds').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/invoices/${invoice_id}`)
}
