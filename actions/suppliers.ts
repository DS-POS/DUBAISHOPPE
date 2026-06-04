'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Supplier } from '@/types/database'

export interface SupplierFormData {
  name: string
  business_name?: string
  phone?: string
  email?: string
  gstin?: string
  address?: string
  state?: string
  notes?: string
}

export async function getSuppliers(search?: string): Promise<Supplier[]> {
  const supabase = await createClient()
  let query = supabase
    .from('suppliers')
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
  return (data ?? []) as Supplier[]
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Supplier
}

export async function createSupplier(formData: SupplierFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('suppliers').insert({
    name: formData.name.trim(),
    business_name: formData.business_name?.trim() || null,
    phone: formData.phone?.trim() || null,
    email: formData.email?.trim() || null,
    gstin: formData.gstin?.trim().toUpperCase() || null,
    address: formData.address?.trim() || null,
    state: formData.state?.trim() || 'Telangana',
    notes: formData.notes?.trim() || null,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/suppliers')
  redirect('/suppliers')
}

export async function updateSupplier(id: string, formData: SupplierFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('suppliers')
    .update({
      name: formData.name.trim(),
      business_name: formData.business_name?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim().toUpperCase() || null,
      address: formData.address?.trim() || null,
      state: formData.state?.trim() || 'Telangana',
      notes: formData.notes?.trim() || null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/suppliers')
  redirect('/suppliers')
}

export async function deleteSupplier(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/suppliers')
}
