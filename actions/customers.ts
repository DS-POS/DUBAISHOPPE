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

export interface StatementTransaction {
  date: string           // ISO date string for sorting
  date_display: string   // formatted 'dd MMM yyyy'
  type: 'invoice' | 'payment'
  reference: string      // invoice_no or 'Payment'
  description: string    // product list snippet or payment method
  debit: number          // invoice amount added to balance
  credit: number         // payment reduces balance
  balance: number        // running balance after this transaction
}

export interface CustomerStatement {
  customer_id: string
  customer_name: string
  opening_balance: number
  transactions: StatementTransaction[]
  closing_balance: number
  total_invoiced: number
  total_paid: number
}

export async function getCustomerStatement(customerId: string): Promise<CustomerStatement> {
  const supabase = await createClient()

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .single()
  if (cErr || !customer) throw new Error('Customer not found')

  // Fetch all non-cancelled invoices
  const { data: invoices, error: iErr } = await supabase
    .from('invoices')
    .select('id, invoice_no, grand_total, created_at, invoice_items(product_name)')
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
  if (iErr) throw new Error(iErr.message)

  const invoiceIds = (invoices ?? []).map(i => i.id)

  // Fetch all payments for those invoices
  let payments: Array<{ invoice_id: string; amount: number; payment_date: string; payment_method: string | null; invoice_no?: string }> = []
  if (invoiceIds.length > 0) {
    const { data: payRows, error: pErr } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount, payment_date, payment_method')
      .in('invoice_id', invoiceIds)
      .order('payment_date', { ascending: true })
    if (pErr) throw new Error(pErr.message)

    // Attach invoice_no for display
    const invoiceNoMap = new Map((invoices ?? []).map(i => [i.id, i.invoice_no]))
    payments = (payRows ?? []).map(p => ({
      ...p,
      invoice_no: invoiceNoMap.get(p.invoice_id),
    }))
  }

  // Build unified transaction list
  const rawTx: Array<{ date: string; tx: StatementTransaction }> = []

  for (const inv of invoices ?? []) {
    const items = (inv.invoice_items as Array<{ product_name: string }>) ?? []
    const productSnippet = items.slice(0, 2).map(i => i.product_name).join(', ') +
      (items.length > 2 ? ` +${items.length - 2} more` : '')
    rawTx.push({
      date: inv.created_at,
      tx: {
        date: inv.created_at,
        date_display: new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        type: 'invoice',
        reference: inv.invoice_no,
        description: productSnippet || 'Sale',
        debit: Number(inv.grand_total),
        credit: 0,
        balance: 0, // computed below
      },
    })
  }

  for (const pay of payments) {
    const payDate = pay.payment_date + 'T00:00:00'
    rawTx.push({
      date: payDate,
      tx: {
        date: payDate,
        date_display: new Date(payDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        type: 'payment',
        reference: pay.invoice_no ?? 'Payment',
        description: `${pay.payment_method ?? 'Payment'} against ${pay.invoice_no ?? 'invoice'}`,
        debit: 0,
        credit: Number(pay.amount),
        balance: 0, // computed below
      },
    })
  }

  // Sort chronologically
  rawTx.sort((a, b) => a.date.localeCompare(b.date))

  // Compute running balance
  let runningBalance = 0
  const transactions: StatementTransaction[] = rawTx.map(({ tx }) => {
    runningBalance += tx.debit - tx.credit
    return { ...tx, balance: Math.round(runningBalance * 100) / 100 }
  })

  const total_invoiced = transactions.filter(t => t.type === 'invoice').reduce((s, t) => s + t.debit, 0)
  const total_paid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.credit, 0)

  return {
    customer_id: customerId,
    customer_name: customer.name,
    opening_balance: 0,
    transactions,
    closing_balance: Math.round(runningBalance * 100) / 100,
    total_invoiced,
    total_paid,
  }
}
