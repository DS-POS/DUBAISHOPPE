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
  phone?: string
  email?: string
  gstin?: string
  address?: string
  state: string
}

export async function createCustomer(formData: CustomerFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('customers').insert({
    name: formData.name.trim(),
    phone: formData.phone?.trim() || null,
    email: formData.email?.trim() || null,
    gstin: formData.gstin?.trim().toUpperCase() || null,
    address: formData.address?.trim() || null,
    state: formData.state || 'Telangana',
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
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim().toUpperCase() || null,
      address: formData.address?.trim() || null,
      state: formData.state || 'Telangana',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  redirect('/customers')
}
