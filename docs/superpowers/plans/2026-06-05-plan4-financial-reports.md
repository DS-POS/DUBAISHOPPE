# Financial Reports (P&L + Cash Flow + Margins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profit & Loss statement, Cash Flow report, Product Margin report, Day-End closing summary, and GST Summary — all with date range filters and Excel export.

**Architecture:** No new DB tables needed. All data computed from existing: invoices, invoice_items, invoice_payments, supplier_payments, expenses (from Plan 1), sales_returns. New `actions/reports-financial.ts` file. New sub-pages under `/reports/`.

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, xlsx (existing), recharts (existing)

**Dependency:** Requires Plan 1 (Expenses) to be implemented first for P&L to show expense deductions.

---

## File Map

| File | Change |
|------|--------|
| `actions/reports-financial.ts` | CREATE — getProfitLoss, getCashFlow, getProductMargins, getDayEndSummary, getGSTSummary |
| `app/(dashboard)/reports/profit-loss/page.tsx` | CREATE — P&L report page |
| `app/(dashboard)/reports/cash-flow/page.tsx` | CREATE — Cash flow report page |
| `app/(dashboard)/reports/margins/page.tsx` | CREATE — Product margin report |
| `app/(dashboard)/reports/day-end/page.tsx` | CREATE — Day-end closing report |
| `app/(dashboard)/reports/page.tsx` | Modify — add new report cards |
| `components/reports/DateRangeFilter.tsx` | CREATE — reusable date range filter |
| `components/reports/ExportButton.tsx` | CREATE — reusable Excel export button |

---

### Task 1: Financial reports actions

**Files:**
- Create: `actions/reports-financial.ts`

- [ ] **Step 1: Create actions/reports-financial.ts with getProfitLoss**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

function dateRange(from: string, to: string) {
  return { from, to }
}

// ─── PROFIT & LOSS ──────────────────────────────────────────────────────────

export interface ProfitLossReport {
  period: { from: string; to: string }
  // Revenue
  gross_revenue: number
  returns_total: number
  net_revenue: number
  // COGS
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  // Expenses
  total_expenses: number
  expenses_by_category: { category: string; amount: number }[]
  // Net
  net_profit: number
  net_margin_pct: number
}

export async function getProfitLoss(from: string, to: string): Promise<ProfitLossReport> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Revenue: sum of paid+pending invoices grand_total
  const { data: invoices } = await supabase
    .from('invoices')
    .select('grand_total')
    .neq('status', 'cancelled')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)

  const gross_revenue = (invoices ?? []).reduce((s, i) => s + Number(i.grand_total), 0)

  // Returns
  const { data: returns } = await supabase
    .from('sales_returns')
    .select('total_refund')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)

  const returns_total = (returns ?? []).reduce((s, r) => s + Number(r.total_refund), 0)
  const net_revenue = gross_revenue - returns_total

  // COGS: sum of (cost_price × quantity) for invoice items in period
  const { data: invoiceItems } = await supabase
    .from('invoice_items')
    .select('quantity, product_id, invoices!inner(created_at, status)')
    .neq('invoices.status', 'cancelled')
    .gte('invoices.created_at', `${from}T00:00:00`)
    .lte('invoices.created_at', `${to}T23:59:59`)

  // Fetch cost prices for products
  let cogs = 0
  if ((invoiceItems ?? []).length > 0) {
    const productIds = [...new Set((invoiceItems ?? []).map(i => i.product_id).filter(Boolean))]
    const { data: products } = await supabase
      .from('products')
      .select('id, cost_price')
      .in('id', productIds as string[])

    const costMap = new Map((products ?? []).map(p => [p.id, Number(p.cost_price)]))
    cogs = (invoiceItems ?? []).reduce((s, item) => {
      const cost = costMap.get(item.product_id ?? '') ?? 0
      return s + cost * item.quantity
    }, 0)
  }

  const gross_profit = net_revenue - cogs
  const gross_margin_pct = net_revenue > 0 ? (gross_profit / net_revenue) * 100 : 0

  // Expenses (requires Plan 1 expenses table)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .gte('date', from)
    .lte('date', to)

  const expByCategory: Record<string, number> = {}
  let total_expenses = 0
  for (const exp of (expenses ?? [])) {
    const cat = (exp.expense_categories as { name: string } | null)?.name ?? 'Other'
    expByCategory[cat] = (expByCategory[cat] ?? 0) + Number(exp.amount)
    total_expenses += Number(exp.amount)
  }

  const net_profit = gross_profit - total_expenses
  const net_margin_pct = net_revenue > 0 ? (net_profit / net_revenue) * 100 : 0

  return {
    period: { from, to },
    gross_revenue, returns_total, net_revenue,
    cogs, gross_profit, gross_margin_pct,
    total_expenses,
    expenses_by_category: Object.entries(expByCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    net_profit, net_margin_pct,
  }
}
```

- [ ] **Step 2: Add getCashFlow**

```typescript
export interface CashFlowEntry {
  date: string
  cash_in: number    // payments received from customers
  cash_out: number   // supplier payments + expenses
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

  // Build a map of all dates in range
  const start = new Date(from)
  const end = new Date(to)
  const map: Record<string, { cash_in: number; cash_out: number }> = {}
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    map[d.toISOString().slice(0, 10)] = { cash_in: 0, cash_out: 0 }
  }

  for (const p of (payments ?? [])) {
    const key = p.payment_date.slice(0, 10)
    if (map[key]) map[key].cash_in += Number(p.amount)
  }
  for (const p of (supplierPayments ?? [])) {
    const key = p.payment_date.slice(0, 10)
    if (map[key]) map[key].cash_out += Number(p.amount)
  }
  for (const e of (expenses ?? [])) {
    const key = e.date.slice(0, 10)
    if (map[key]) map[key].cash_out += Number(e.amount)
  }

  return Object.entries(map)
    .map(([date, v]) => ({ date, cash_in: v.cash_in, cash_out: v.cash_out, net: v.cash_in - v.cash_out }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 3: Add getProductMargins**

```typescript
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

  const productIds = [...new Set(items.map(i => i.product_id as string))]
  const { data: products } = await supabase
    .from('products')
    .select('id, cost_price')
    .in('id', productIds)

  const costMap = new Map((products ?? []).map(p => [p.id, Number(p.cost_price)]))
  const byProduct: Record<string, ProductMargin> = {}

  for (const item of items) {
    const pid = item.product_id as string
    if (!byProduct[pid]) {
      byProduct[pid] = { product_id: pid, product_name: item.product_name, sku: item.sku ?? '', qty_sold: 0, revenue: 0, cogs: 0, gross_profit: 0, margin_pct: 0 }
    }
    const cost = costMap.get(pid) ?? 0
    byProduct[pid].qty_sold += item.quantity
    byProduct[pid].revenue += Number(item.total)
    byProduct[pid].cogs += cost * item.quantity
  }

  return Object.values(byProduct).map(p => ({
    ...p,
    gross_profit: p.revenue - p.cogs,
    margin_pct: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0,
  })).sort((a, b) => b.gross_profit - a.gross_profit)
}
```

- [ ] **Step 4: Add getDayEndSummary**

```typescript
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
  for (const p of (payments ?? [])) {
    const m = p.payment_method ?? 'other'
    byMethod[m] = (byMethod[m] ?? 0) + Number(p.amount)
  }

  return {
    date,
    sales_count: (invoices ?? []).length,
    gross_sales,
    returns_count: (returns ?? []).length,
    returns_total,
    net_sales: gross_sales - returns_total,
    cash_collected,
    payments_by_method: Object.entries(byMethod).map(([method, amount]) => ({ method, amount })),
    expenses_total,
    net_cash: cash_collected - expenses_total,
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add actions/reports-financial.ts
git commit -m "feat(reports): getProfitLoss + getCashFlow + getProductMargins + getDayEndSummary actions"
```

---

### Task 2: DateRangeFilter + ExportButton components

**Files:**
- Create: `components/reports/DateRangeFilter.tsx`
- Create: `components/reports/ExportButton.tsx`

- [ ] **Step 1: Create DateRangeFilter.tsx**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  basePath: string
}

export function DateRangeFilter({ basePath }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const defaultTo = now.toISOString().slice(0,10)

  const from = params.get('from') ?? defaultFrom
  const to = params.get('to') ?? defaultTo

  function apply(newFrom: string, newTo: string) {
    router.push(`${basePath}?from=${newFrom}&to=${newTo}`)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Quick presets */}
      {[
        { label: 'Today', f: defaultTo, t: defaultTo },
        { label: 'This Month', f: defaultFrom, t: defaultTo },
        { label: 'Last Month', f: (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toISOString().slice(0,10) })(), t: (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0,10) })() },
        { label: 'This Year', f: `${now.getFullYear()}-01-01`, t: defaultTo },
      ].map(preset => (
        <button
          key={preset.label}
          onClick={() => apply(preset.f, preset.t)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${from === preset.f && to === preset.t ? 'bg-[#111827] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {preset.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={from}
          onChange={e => apply(e.target.value, to)}
          className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={to}
          onChange={e => apply(from, e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ExportButton.tsx**

```tsx
'use client'

import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'

interface Props {
  filename: string
  getData: () => object[]
}

export function ExportButton({ filename, getData }: Props) {
  const [loading, setLoading] = useState(false)
  async function handleExport() {
    setLoading(true)
    try {
      const xlsx = await import('xlsx')
      const ws = xlsx.utils.json_to_sheet(getData())
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Report')
      xlsx.writeFile(wb, filename)
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
    >
      <DownloadIcon className="size-4" />
      {loading ? 'Exporting...' : 'Export Excel'}
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/reports/
git commit -m "feat(reports): DateRangeFilter + ExportButton reusable components"
```

---

### Task 3: P&L report page

**Files:**
- Create: `app/(dashboard)/reports/profit-loss/page.tsx`

- [ ] **Step 1: Create profit-loss page**

```tsx
import { getProfitLoss } from '@/actions/reports-financial'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'

interface Props { searchParams: Promise<{ from?: string; to?: string }> }

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const pct = (n: number) => `${n.toFixed(1)}%`

export default async function ProfitLossPage({ searchParams }: Props) {
  const { from, to } = await searchParams
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const fromDate = from ?? defaultFrom
  const toDate = to ?? now.toISOString().slice(0,10)

  const report = await getProfitLoss(fromDate, toDate)

  const rows = [
    { label: 'Gross Revenue', value: report.gross_revenue, bold: false, color: '' },
    { label: 'Less: Returns', value: -report.returns_total, bold: false, color: 'text-red-600' },
    { label: 'Net Revenue', value: report.net_revenue, bold: true, color: '' },
    { label: 'Less: Cost of Goods Sold', value: -report.cogs, bold: false, color: 'text-red-600' },
    { label: 'Gross Profit', value: report.gross_profit, bold: true, color: report.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
    { label: `Gross Margin`, value: null, note: pct(report.gross_margin_pct), bold: false, color: 'text-slate-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profit & Loss</h1>
          <p className="text-sm text-slate-500 mt-0.5">{fromDate} to {toDate}</p>
        </div>
        <DateRangeFilter basePath="/reports/profit-loss" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Net Revenue', value: fmt(report.net_revenue), color: 'text-slate-900' },
          { label: 'Gross Profit', value: fmt(report.gross_profit), color: report.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Total Expenses', value: fmt(report.total_expenses), color: 'text-red-600' },
          { label: 'Net Profit', value: fmt(report.net_profit), color: report.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-black mt-0.5 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* P&L table */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden max-w-xl">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Income Statement</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { section: 'REVENUE', items: [
              { label: 'Gross Revenue', value: fmt(report.gross_revenue) },
              { label: 'Less: Sales Returns', value: `(${fmt(report.returns_total)})`, red: true },
              { label: 'Net Revenue', value: fmt(report.net_revenue), bold: true },
            ]},
            { section: 'COST OF GOODS', items: [
              { label: 'Cost of Goods Sold', value: `(${fmt(report.cogs)})`, red: true },
              { label: `Gross Profit (${pct(report.gross_margin_pct)})`, value: fmt(report.gross_profit), bold: true, green: report.gross_profit >= 0 },
            ]},
            { section: 'OPERATING EXPENSES', items: [
              ...report.expenses_by_category.map(e => ({ label: e.category, value: `(${fmt(e.amount)})`, red: true })),
              { label: 'Total Expenses', value: `(${fmt(report.total_expenses)})`, bold: true, red: true },
            ]},
            { section: 'NET PROFIT', items: [
              { label: `Net Profit (${pct(report.net_margin_pct)})`, value: fmt(report.net_profit), bold: true, green: report.net_profit >= 0, bigRed: report.net_profit < 0 },
            ]},
          ].map(section => (
            <div key={section.section}>
              <div className="px-5 py-2 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{section.section}</span>
              </div>
              {section.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center px-5 py-2.5">
                  <span className={`text-sm ${(item as { bold?: boolean }).bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{item.label}</span>
                  <span className={`text-sm font-medium ${(item as { red?: boolean }).red ? 'text-red-600' : (item as { green?: boolean }).green ? 'text-emerald-600' : (item as { bigRed?: boolean }).bigRed ? 'text-red-600' : 'text-slate-900'} ${(item as { bold?: boolean }).bold ? 'font-bold' : ''}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/reports/profit-loss/
git commit -m "feat(reports): /reports/profit-loss P&L statement page"
```

---

### Task 4: Product Margins + Day-End pages

**Files:**
- Create: `app/(dashboard)/reports/margins/page.tsx`
- Create: `app/(dashboard)/reports/day-end/page.tsx`

- [ ] **Step 1: Create margins page**

```tsx
import { getProductMargins } from '@/actions/reports-financial'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'

interface Props { searchParams: Promise<{ from?: string; to?: string }> }

export default async function MarginsPage({ searchParams }: Props) {
  const { from, to } = await searchParams
  const now = new Date()
  const fromDate = from ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const toDate = to ?? now.toISOString().slice(0,10)

  const margins = await getProductMargins(fromDate, toDate)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Margins</h1>
          <p className="text-sm text-slate-500 mt-0.5">{fromDate} to {toDate}</p>
        </div>
        <DateRangeFilter basePath="/reports/margins" />
      </div>

      {margins.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <p className="font-semibold text-slate-600">No sales in this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Qty Sold</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">COGS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Gross Profit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {margins.map(row => (
                <tr key={row.product_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.product_name}</p>
                    <p className="text-xs text-slate-400">{row.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.qty_sold}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{row.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right text-red-600">₹{row.cogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{row.gross_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.margin_pct >= 20 ? 'bg-emerald-100 text-emerald-700' : row.margin_pct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {row.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create day-end page**

```tsx
import { getDayEndSummary } from '@/actions/reports-financial'

interface Props { searchParams: Promise<{ date?: string }> }

export default async function DayEndPage({ searchParams }: Props) {
  const { date } = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const reportDate = date ?? today
  const summary = await getDayEndSummary(reportDate)

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Day-End Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date(reportDate).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>
        </div>
        <input
          type="date"
          defaultValue={reportDate}
          onChange={e => { if(e.target.value) window.location.href = `/reports/day-end?date=${e.target.value}` }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Invoices', value: `${summary.sales_count}`, sub: fmt(summary.gross_sales), color: 'text-slate-900' },
          { label: 'Returns', value: `${summary.returns_count}`, sub: fmt(summary.returns_total), color: 'text-red-600' },
          { label: 'Net Sales', value: fmt(summary.net_sales), sub: '', color: 'text-emerald-600' },
          { label: 'Cash Collected', value: fmt(summary.cash_collected), sub: '', color: 'text-blue-600' },
          { label: 'Expenses', value: fmt(summary.expenses_total), sub: '', color: 'text-red-600' },
          { label: 'Net Cash', value: fmt(summary.net_cash), sub: '', color: summary.net_cash >= 0 ? 'text-emerald-700' : 'text-red-700' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-black mt-0.5 ${card.color}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {summary.payments_by_method.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Payments Received by Method</h2>
          <div className="space-y-2">
            {summary.payments_by_method.map(p => (
              <div key={p.method} className="flex justify-between text-sm">
                <span className="capitalize text-slate-600">{p.method.replace('_',' ')}</span>
                <span className="font-semibold text-slate-900">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/reports/margins/ app/(dashboard)/reports/day-end/
git commit -m "feat(reports): /reports/margins product margins + /reports/day-end closing summary"
```

---

### Task 5: Update reports index page

**Files:**
- Modify: `app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Add new report cards to reports page**

Add these cards to the reports index:
```tsx
{ href: '/reports/profit-loss', label: 'Profit & Loss', description: 'Revenue, COGS, expenses, net profit', icon: TrendingUpIcon },
{ href: '/reports/margins', label: 'Product Margins', description: 'Margin % per product', icon: BarChart2Icon },
{ href: '/reports/day-end', label: 'Day-End Summary', description: 'Daily sales, collections, expenses', icon: SunsetIcon },
{ href: '/reports/receivables', label: 'Receivables (AR)', description: 'Customer outstanding aging', icon: UsersIcon },
{ href: '/reports/payables', label: 'Payables (AP)', description: 'Supplier outstanding aging', icon: TruckIcon },
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/reports/
git commit -m "feat(reports): add new report links to reports index"
```

---

### Task 6: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Test**

1. `/reports/profit-loss` → shows revenue, COGS, expenses, net profit for current month
2. Date range filter → "Last Month" preset works, custom date range works
3. `/reports/margins` → shows products sorted by gross profit, margin % badges
4. `/reports/day-end` → shows today's summary, date picker changes date
5. `/reports/receivables` and `/reports/payables` → linked from reports index

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(reports): complete financial reports — P&L, margins, day-end, AR, AP"
```
