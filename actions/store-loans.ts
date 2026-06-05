'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StoreLoan, StoreLoanDirection, StoreLoanStatus } from '@/types/database'

export interface CreateStoreLoanData {
  direction: StoreLoanDirection
  store_name: string
  person_name: string
  product_name: string
  quantity: number
  price?: number | null
  loan_date: string
  expected_return_date?: string | null
  notes?: string | null
}

export interface StoreLoanStats {
  lent_out_pending_count: number
  lent_out_pending_value: number
  borrowed_in_pending_count: number
  borrowed_in_pending_value: number
}

export async function getStoreLoanStats(): Promise<StoreLoanStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('store_loans')
    .select('direction, price, quantity')
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  const rows = data ?? []

  const stats: StoreLoanStats = {
    lent_out_pending_count: 0,
    lent_out_pending_value: 0,
    borrowed_in_pending_count: 0,
    borrowed_in_pending_value: 0,
  }

  for (const row of rows) {
    const value = Number(row.price ?? 0) * Number(row.quantity)
    if (row.direction === 'lent_out') {
      stats.lent_out_pending_count++
      stats.lent_out_pending_value += value
    } else {
      stats.borrowed_in_pending_count++
      stats.borrowed_in_pending_value += value
    }
  }

  return stats
}

export async function getStoreLoans(params?: {
  direction?: StoreLoanDirection
  status?: StoreLoanStatus
}): Promise<StoreLoan[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('store_loans')
    .select('*')
    .order('loan_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.direction) query = query.eq('direction', params.direction)
  if (params?.status) query = query.eq('status', params.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getStoreLoan(id: string): Promise<StoreLoan | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('store_loans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function createStoreLoan(data: CreateStoreLoanData): Promise<StoreLoan> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: created, error } = await supabase
    .from('store_loans')
    .insert({
      direction: data.direction,
      store_name: data.store_name.trim(),
      person_name: data.person_name.trim(),
      product_name: data.product_name.trim(),
      quantity: data.quantity,
      price: data.price ?? null,
      loan_date: data.loan_date,
      expected_return_date: data.expected_return_date ?? null,
      notes: data.notes?.trim() ?? null,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/store-loans')
  revalidatePath('/dashboard')
  return created
}

export async function markLoanReturned(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('store_loans')
    .update({
      status: 'returned',
      returned_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/store-loans')
  revalidatePath(`/store-loans/${id}`)
  revalidatePath('/dashboard')
}

export async function deleteStoreLoan(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('store_loans')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/store-loans')
  revalidatePath('/dashboard')
}
