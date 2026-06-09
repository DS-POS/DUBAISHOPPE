'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Expense, ExpenseCategory } from '@/types/database'

export interface CreateExpenseData {
  date: string
  category_id: string
  amount: number
  description: string
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque'
  reference_no?: string
  notes?: string
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExpenses(params?: {
  from?: string
  to?: string
  category_id?: string
}): Promise<Expense[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('expenses')
    .select('*, expense_categories(id, name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.from) query = query.gte('date', params.from)
  if (params?.to) query = query.lte('date', params.to)
  if (params?.category_id) query = query.eq('category_id', params.category_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createExpense(data: CreateExpenseData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('expenses').insert({
    ...data,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/expenses')
  revalidatePath('/dashboard')
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/expenses')
  revalidatePath('/dashboard')
}

export interface ExpenseSummary {
  total: number
  by_category: { category: string; total: number }[]
}

export async function getExpenseSummary(year: number, month: number): Promise<ExpenseSummary> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .gte('date', from)
    .lte('date', to)

  if (error) throw new Error(error.message)
  const rows = data ?? []

  const byCategory: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    const catRaw = row.expense_categories as unknown as { name: string } | { name: string }[] | null
    const cat = (Array.isArray(catRaw) ? catRaw[0]?.name : catRaw?.name) ?? 'Uncategorised'
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(row.amount)
    total += Number(row.amount)
  }

  return {
    total,
    by_category: Object.entries(byCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
  }
}

export async function createExpenseCategory(name: string): Promise<{ data?: ExpenseCategory; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name: name.trim() })
      .select()
      .single()
    if (error) return { error: error.message }
    revalidatePath('/expenses')
    return { data: data as ExpenseCategory }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create category' }
  }
}
