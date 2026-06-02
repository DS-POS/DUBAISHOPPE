'use server'

import { createClient } from '@/lib/supabase/server'
import { recomputePaymentStatus } from '@/actions/supplier-invoices'

export interface AddPaymentData {
  supplier_invoice_id: string
  amount: number
  payment_date: string
  payment_reference?: string
  payment_method?: 'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'
  notes?: string
}

export async function addSupplierPayment(data: AddPaymentData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('supplier_payments').insert({
    supplier_invoice_id: data.supplier_invoice_id,
    amount: data.amount,
    payment_date: data.payment_date,
    payment_reference: data.payment_reference || null,
    payment_method: data.payment_method || null,
    notes: data.notes || null,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  await recomputePaymentStatus(data.supplier_invoice_id)
}

export async function deleteSupplierPayment(
  paymentId: string,
  invoiceId: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('supplier_payments')
    .delete()
    .eq('id', paymentId)
  if (error) throw new Error(error.message)

  await recomputePaymentStatus(invoiceId)
}
