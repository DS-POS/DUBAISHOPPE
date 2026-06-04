'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AddInvoicePaymentData {
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit'
  payment_reference?: string
  notes?: string
}

export async function addInvoicePayment(data: AddInvoicePaymentData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Insert payment record
  const { error: insertError } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: data.invoice_id,
      amount: data.amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference ?? null,
      notes: data.notes ?? null,
      created_by: user.id,
    })
  if (insertError) throw new Error(insertError.message)

  // 2. Recompute amount_paid + status on the invoice
  await recomputeInvoicePaymentStatus(data.invoice_id, supabase)

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${data.invoice_id}`)
}

export async function deleteInvoicePayment(paymentId: string, invoiceId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('invoice_payments').delete().eq('id', paymentId)
  if (error) throw new Error(error.message)

  await recomputeInvoicePaymentStatus(invoiceId, supabase)

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)
}

export async function getInvoicePayments(invoiceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Internal helper — recomputes amount_paid and status
async function recomputeInvoicePaymentStatus(
  invoiceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<void> {
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('grand_total').eq('id', invoiceId).single(),
    supabase.from('invoice_payments').select('amount').eq('invoice_id', invoiceId),
  ])

  const totalPaid = (payments ?? []).reduce(
    (sum: number, p: { amount: number }) => sum + Number(p.amount),
    0
  )
  const grandTotal = Number(invoice?.grand_total ?? 0)
  // Compare in integer paise to avoid floating-point drift (e.g. 0.1 + 0.2 !== 0.3)
  const status = Math.round(totalPaid * 100) >= Math.round(grandTotal * 100) ? 'paid' : 'pending'

  await supabase
    .from('invoices')
    .update({ amount_paid: totalPaid, status })
    .eq('id', invoiceId)
}
