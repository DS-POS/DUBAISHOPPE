'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Category } from '@/types/database'

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCategory(name: string): Promise<Category> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim() })
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check no products reference this category
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if ((count ?? 0) > 0) throw new Error('Cannot delete category with existing products')

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
}
