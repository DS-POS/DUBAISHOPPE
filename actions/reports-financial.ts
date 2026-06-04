'use server'

import { createClient } from '@/lib/supabase/server'

export interface ProfitLossReport {
  period: { from: string; to: string }
  gross_revenue: number
  returns_total: number
  net_revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  total_expenses: number
  expenses_by_category: { category: string; amount: number }[]
  net_profit: number
  net_margin_pct: number
}

export async function getProfitLoss(from: string, to: string): Promise<ProfitLossReport> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoices } = await supabase
    .from('invoices').select('grand_total').neq('status', 'cancelled')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
  const gross_revenue = (invoices ?? []).reduce((s, i) => s + Number(i.grand_total), 0)

  const { data: returns } = await supabase
    .from('sales_returns').select('total_refund')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
  const returns_total = (returns ?? []).reduce((s, r) => s + Number(r.total_refund), 0)
  const net_revenue = gross_revenue - returns_total

  const { data: invoiceItems } = await supabase
    .from('invoice_items')
    .select('quantity, product_id, invoices!inner(created_at, status)')
    .neq('invoices.status', 'cancelled')
    .gte('invoices.created_at', `${from}T00:00:00`)
    .lte('invoices.created_at', `${to}T23:59:59`)

  let cogs = 0
  const itemList = invoiceItems ?? []
  if (itemList.length > 0) {
    const productIds = Array.from(new Set(itemList.map(i => i.product_id).filter(Boolean))) as string[]
    const { data: products } = await supabase.from('products').select('id, cost_price').in('id', productIds)
    const costMap = new Map((products ?? []).map(p => [p.id, Number(p.cost_price)]))
    cogs = itemList.reduce((s, item) => s + (costMap.get(item.product_id ?? '') ?? 0) * item.quantity, 0)
  }

  const gross_profit = net_revenue - cogs
  const gross_margin_pct = net_revenue > 0 ? (gross_profit / net_revenue) * 100 : 0

  const { data: expenses } = await supabase
    .from('expenses').select('amount, expense_categories(name)').gte('date', from).lte('date', to)
  const expByCategory: Record<string, number> = {}
  let total_expenses = 0
  for (const exp of (expenses ?? [])) {
    const cat = (exp.expense_categories as unknown as { name: string } | null)?.name ?? 'Other'
    expByCategory[cat] = (expByCategory[cat] ?? 0) + Number(exp.amount)
    total_expenses += Number(exp.amount)
  }

  const net_profit = gross_profit - total_expenses
  const net_margin_pct = net_revenue > 0 ? (net_profit / net_revenue) * 100 : 0

  return {
    period: { from, to }, gross_revenue, returns_total, net_revenue,
    cogs, gross_profit, gross_margin_pct, total_expenses,
    expenses_by_category: Object.entries(expByCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    net_profit, net_margin_pct,
  }
}

export interface CashFlowEntry {
  date: string
  cash_in: number
  cash_out: number
  net: number
}

export async function getCashFlow(from: string, to: string): Promise<CashFlowEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [{ data: payments }, { data: supplierPayments }, { data: expenses }] = await Promise.all([
    supabase.from('invoice_payments').select('amount, payment_date').gte('payment_date', from).lte('payment_date', to),
    supabase.from('supplier_payments').select('amount, payment_date').gte('payment_date', from).lte('payment_date', to),
    supabase.from('expenses').select('amount, date').gte('date', from).lte('date', to),
  ])

  const map: Record<string, { cash_in: number; cash_out: number }> = {}
  const start = new Date(from), end = new Date(to)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    map[d.toISOString().slice(0, 10)] = { cash_in: 0, cash_out: 0 }
  }
  for (const p of (payments ?? [])) { const k = p.payment_date.slice(0,10); if (map[k]) map[k].cash_in += Number(p.amount) }
  for (const p of (supplierPayments ?? [])) { const k = p.payment_date.slice(0,10); if (map[k]) map[k].cash_out += Number(p.amount) }
  for (const e of (expenses ?? [])) { const k = e.date.slice(0,10); if (map[k]) map[k].cash_out += Number(e.amount) }

  return Object.entries(map).map(([date, v]) => ({ date, cash_in: v.cash_in, cash_out: v.cash_out, net: v.cash_in - v.cash_out })).sort((a, b) => a.date.localeCompare(b.date))
}

export interface ProductMargin {
  product_id: string
  product_name: string
  sku: string
  qty_sold: number
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
}

export async function getProductMargins(from: string, to: string): Promise<ProductMargin[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: items } = await supabase
    .from('invoice_items')
    .select('product_id, product_name, sku, quantity, total, invoices!inner(created_at, status)')
    .neq('invoices.status', 'cancelled')
    .gte('invoices.created_at', `${from}T00:00:00`)
    .lte('invoices.created_at', `${to}T23:59:59`)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) return []

  const productIds = Array.from(new Set(items.map(i => i.product_id as string)))
  const { data: products } = await supabase.from('products').select('id, cost_price').in('id', productIds)
  const costMap = new Map((products ?? []).map(p => [p.id, Number(p.cost_price)]))
  const byProduct: Record<string, ProductMargin> = {}
  for (const item of items) {
    const pid = item.product_id as string
    if (!byProduct[pid]) byProduct[pid] = { product_id: pid, product_name: item.product_name, sku: item.sku ?? '', qty_sold: 0, revenue: 0, cogs: 0, gross_profit: 0, margin_pct: 0 }
    byProduct[pid].qty_sold += item.quantity
    byProduct[pid].revenue += Number(item.total)
    byProduct[pid].cogs += (costMap.get(pid) ?? 0) * item.quantity
  }
  return Object.values(byProduct).map(p => ({ ...p, gross_profit: p.revenue - p.cogs, margin_pct: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0 })).sort((a, b) => b.gross_profit - a.gross_profit)
}

export interface DayEndSummary {
  date: string
  sales_count: number
  gross_sales: number
  returns_count: number
  returns_total: number
  net_sales: number
  cash_collected: number
  payments_by_method: { method: string; amount: number }[]
  expenses_total: number
  net_cash: number
}

export async function getDayEndSummary(date: string): Promise<DayEndSummary> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [{ data: invoices }, { data: returns }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('invoices').select('id, grand_total').neq('status','cancelled').gte('created_at',`${date}T00:00:00`).lte('created_at',`${date}T23:59:59`),
    supabase.from('sales_returns').select('total_refund').gte('created_at',`${date}T00:00:00`).lte('created_at',`${date}T23:59:59`),
    supabase.from('invoice_payments').select('amount, payment_method').gte('payment_date', date).lte('payment_date', date),
    supabase.from('expenses').select('amount').gte('date', date).lte('date', date),
  ])

  const gross_sales = (invoices ?? []).reduce((s, i) => s + Number(i.grand_total), 0)
  const returns_total = (returns ?? []).reduce((s, r) => s + Number(r.total_refund), 0)
  const cash_collected = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const expenses_total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const byMethod: Record<string, number> = {}
  for (const p of (payments ?? [])) { const m = p.payment_method ?? 'other'; byMethod[m] = (byMethod[m] ?? 0) + Number(p.amount) }

  return {
    date, sales_count: (invoices ?? []).length, gross_sales, returns_count: (returns ?? []).length, returns_total,
    net_sales: gross_sales - returns_total, cash_collected,
    payments_by_method: Object.entries(byMethod).map(([method, amount]) => ({ method, amount })),
    expenses_total, net_cash: cash_collected - expenses_total,
  }
}
