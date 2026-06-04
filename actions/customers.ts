'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Customer } from '@/types/database'

export async function getCustomers(search?: string): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })
    .limit(200)

  if (search?.trim()) {
    query = query.or(
      `name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,gstin.ilike.%${search.trim()}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Customer[]
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Customer
}

export interface CustomerFormData {
  name: string
  business_name?: string
  phone?: string
  email?: string
  gstin?: string
  address?: string
  state: string
  credit_limit?: number
}

export async function createCustomer(formData: CustomerFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('customers').insert({
    name: formData.name.trim(),
    business_name: formData.business_name?.trim() || null,
    phone: formData.phone?.trim() || null,
    email: formData.email?.trim() || null,
    gstin: formData.gstin?.trim().toUpperCase() || null,
    address: formData.address?.trim() || null,
    state: formData.state || 'Telangana',
    credit_limit: formData.credit_limit ?? 0,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  redirect('/customers')
}

export async function updateCustomer(id: string, formData: CustomerFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('customers')
    .update({
      name: formData.name.trim(),
      business_name: formData.business_name?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim().toUpperCase() || null,
      address: formData.address?.trim() || null,
      state: formData.state || 'Telangana',
      credit_limit: formData.credit_limit ?? 0,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  redirect('/customers')
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
}

export async function createCustomerAndReturnId(formData: CustomerFormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: formData.name.trim(),
      business_name: formData.business_name?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim().toUpperCase() || null,
      address: formData.address?.trim() || null,
      state: formData.state || 'Telangana',
      credit_limit: formData.credit_limit ?? 0,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  return data.id
}

export async function getCustomerInvoices(customerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, grand_total, status, payment_method, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data ?? []
}

export interface CustomerCreditSummary {
  customer_id: string
  credit_limit: number
  outstanding: number
  available_credit: number
}

export async function getCustomerCreditSummary(customerId: string): Promise<CustomerCreditSummary> {
  const supabase = await createClient()

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, credit_limit')
    .eq('id', customerId)
    .single()
  if (cErr || !customer) throw new Error('Customer not found')

  const { data: invoices, error: iErr } = await supabase
    .from('invoices')
    .select('grand_total, amount_paid')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
  if (iErr) throw new Error(iErr.message)

  const outstanding = (invoices ?? []).reduce(
    (sum, inv) => sum + (inv.grand_total - inv.amount_paid),
    0
  )

  return {
    customer_id: customerId,
    credit_limit: customer.credit_limit,
    outstanding: Math.max(0, outstanding),
    available_credit: Math.max(0, customer.credit_limit - outstanding),
  }
}
