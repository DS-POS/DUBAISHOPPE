'use server'

import { createClient } from '@/lib/supabase/server'

export interface ReportData {
  totalRevenue: number
  totalInvoices: number
  totalPaid: number
  totalDue: number
  averageOrderValue: number
  paymentBreakdown: Array<{ method: string; count: number; amount: number }>
  dailyRevenue: Array<{ date: string; amount: number; count: number }>
  topProducts: Array<{
    product_name: string
    sku: string | null
    quantity: number
    revenue: number
  }>
  topCustomers: Array<{
    customer_name: string
    invoice_count: number
    total_spend: number
  }>
  invoices: Array<{
    invoice_no: string
    created_at: string
    customer_name: string | null
    payment_method: string | null
    subtotal: number
    discount: number
    taxable_amount: number
    cgst: number
    sgst: number
    igst: number
    total_gst: number
    grand_total: number
    amount_paid: number
    status: string
  }>
}

export async function getReportData(params: {
  from: string
  to: string
}): Promise<ReportData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Build date range — end of the "to" day
  const fromDate = `${params.from}T00:00:00.000Z`
  const toDate = `${params.to}T23:59:59.999Z`

  // Fetch all invoices in range (exclude cancelled)
  const { data: rawInvoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_no, created_at, customer_id, payment_method, subtotal, discount, taxable_amount, cgst, sgst, igst, total_gst, grand_total, amount_paid, status, customers(name)')
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (invErr) throw new Error(invErr.message)
  const invoiceRows = rawInvoices ?? []

  // Summary stats
  const totalRevenue = invoiceRows.reduce((sum, i) => sum + Number(i.grand_total), 0)
  const totalPaid = invoiceRows.reduce((sum, i) => sum + Number(i.amount_paid), 0)
  const totalDue = invoiceRows.reduce((sum, i) => {
    const due = Number(i.grand_total) - Number(i.amount_paid)
    return sum + (due > 0 ? due : 0)
  }, 0)
  const totalInvoices = invoiceRows.length
  const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

  // Payment breakdown
  const paymentMap = new Map<string, { count: number; amount: number }>()
  for (const inv of invoiceRows) {
    const method = inv.payment_method ?? 'unknown'
    const existing = paymentMap.get(method) ?? { count: 0, amount: 0 }
    paymentMap.set(method, {
      count: existing.count + 1,
      amount: existing.amount + Number(inv.grand_total),
    })
  }
  const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, v]) => ({
    method,
    count: v.count,
    amount: v.amount,
  })).sort((a, b) => b.amount - a.amount)

  // Daily revenue — group by date
  const dailyMap = new Map<string, { amount: number; count: number }>()
  for (const inv of invoiceRows) {
    const date = inv.created_at.split('T')[0]
    const existing = dailyMap.get(date) ?? { amount: 0, count: 0 }
    dailyMap.set(date, {
      amount: existing.amount + Number(inv.grand_total),
      count: existing.count + 1,
    })
  }
  // Fill in missing dates with 0
  const dailyRevenue: Array<{ date: string; amount: number; count: number }> = []
  const start = new Date(params.from)
  const end = new Date(params.to)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const entry = dailyMap.get(dateStr) ?? { amount: 0, count: 0 }
    dailyRevenue.push({ date: dateStr, amount: entry.amount, count: entry.count })
  }

  // Top products — fetch invoice_items for invoices in range
  const invoiceIds = invoiceRows.map(i => i.id)
  let topProducts: ReportData['topProducts'] = []

  if (invoiceIds.length > 0) {
    const { data: itemRows, error: itemErr } = await supabase
      .from('invoice_items')
      .select('product_name, sku, quantity, total')
      .in('invoice_id', invoiceIds)

    if (itemErr) throw new Error(itemErr.message)

    const productMap = new Map<string, { sku: string | null; quantity: number; revenue: number }>()
    for (const item of (itemRows ?? [])) {
      const key = item.product_name
      const existing = productMap.get(key) ?? { sku: item.sku, quantity: 0, revenue: 0 }
      productMap.set(key, {
        sku: existing.sku ?? item.sku,
        quantity: existing.quantity + Number(item.quantity),
        revenue: existing.revenue + Number(item.total),
      })
    }
    topProducts = Array.from(productMap.entries())
      .map(([product_name, v]) => ({ product_name, sku: v.sku, quantity: v.quantity, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }

  // Top customers
  const customerMap = new Map<string, { invoice_count: number; total_spend: number }>()
  for (const inv of invoiceRows) {
    const cust = (inv as unknown as { customers: { name: string } | null }).customers
    const name = cust?.name ?? 'Walk-in'
    const existing = customerMap.get(name) ?? { invoice_count: 0, total_spend: 0 }
    customerMap.set(name, {
      invoice_count: existing.invoice_count + 1,
      total_spend: existing.total_spend + Number(inv.grand_total),
    })
  }
  const topCustomers = Array.from(customerMap.entries())
    .map(([customer_name, v]) => ({ customer_name, invoice_count: v.invoice_count, total_spend: v.total_spend }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, 10)

  // Flat invoices list for export
  const invoices = invoiceRows.map(inv => {
    const cust = (inv as unknown as { customers: { name: string } | null }).customers
    return {
      invoice_no: inv.invoice_no,
      created_at: inv.created_at,
      customer_name: cust?.name ?? null,
      payment_method: inv.payment_method,
      subtotal: Number(inv.subtotal),
      discount: Number(inv.discount),
      taxable_amount: Number(inv.taxable_amount),
      cgst: Number(inv.cgst),
      sgst: Number(inv.sgst),
      igst: Number(inv.igst),
      total_gst: Number(inv.total_gst),
      grand_total: Number(inv.grand_total),
      amount_paid: Number(inv.amount_paid),
      status: inv.status,
    }
  })

  return {
    totalRevenue,
    totalInvoices,
    totalPaid,
    totalDue,
    averageOrderValue,
    paymentBreakdown,
    dailyRevenue,
    topProducts,
    topCustomers,
    invoices,
  }
}
