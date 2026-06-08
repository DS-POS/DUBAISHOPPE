# Dashboard Redesign + Store Loans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard (remove verbose invoice tables → compact cards) and build a full Store Loans module for tracking inter-store item lending/borrowing.

**Architecture:** New `store_loans` DB table (migration 012) with direction (lent_out/borrowed_in), status, store/person/product info. Server actions in `actions/store-loans.ts`. Dashboard gets `StoreLoansWidget` (two stat cards). Full CRUD pages at `/store-loans`. Dashboard invoice tables removed — replaced with compact summary cards.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgreSQL, Tailwind CSS, shadcn/ui (sonner toasts), lucide-react icons, `date-fns`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/012_store_loans.sql` | Create | DB table + RLS policies |
| `types/database.ts` | Modify | Add `StoreLoan`, `StoreLoanDirection`, `StoreLoanStatus` types |
| `actions/store-loans.ts` | Create | CRUD server actions |
| `components/dashboard/StoreLoansWidget.tsx` | Create | Two stat cards for dashboard |
| `app/(dashboard)/dashboard/page.tsx` | Modify | Remove invoice tables, add compact cards + widget |
| `app/(dashboard)/store-loans/page.tsx` | Create | List all loans with filters |
| `app/(dashboard)/store-loans/new/page.tsx` | Create | New loan page shell |
| `components/store-loans/StoreLoanForm.tsx` | Create | Client form component |
| `app/(dashboard)/store-loans/[id]/page.tsx` | Create | Detail + Mark Returned + Delete |
| `components/layout/Sidebar.tsx` | Modify | Add Store Loans nav item |

---

## Task 1: DB Migration — store_loans table

**Files:**
- Create: `supabase/migrations/012_store_loans.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/012_store_loans.sql

create table public.store_loans (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('lent_out', 'borrowed_in')),
  store_name text not null,
  person_name text not null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  price numeric(12,2) check (price >= 0),
  loan_date date not null default current_date,
  expected_return_date date,
  returned_date date,
  status text not null default 'pending' check (status in ('pending', 'returned', 'converted_to_invoice')),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.store_loans enable row level security;

create policy "authenticated all store_loans"
  on public.store_loans for all to authenticated
  using (true) with check (true);

create index store_loans_direction_idx on public.store_loans(direction);
create index store_loans_status_idx on public.store_loans(status);
create index store_loans_loan_date_idx on public.store_loans(loan_date desc);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with project_id `lzvyzfwbsssvofrjbndx` and the SQL above.

Expected: `{ "success": true }` — no error.

- [ ] **Step 3: Verify table created**

Use `mcp__supabase__execute_sql` with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'store_loans'
ORDER BY ordinal_position;
```

Expected: columns `id`, `direction`, `store_name`, `person_name`, `product_name`, `quantity`, `price`, `loan_date`, `expected_return_date`, `returned_date`, `status`, `notes`, `created_by`, `created_at`, `updated_at` — all present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_store_loans.sql
git commit -m "feat(db): store_loans table — inter-store lending tracker (migration 012)"
```

---

## Task 2: TypeScript Types + Server Actions

**Files:**
- Modify: `types/database.ts` (append near bottom, after `Expense` interface)
- Create: `actions/store-loans.ts`

- [ ] **Step 1: Add types to `types/database.ts`**

Find the `Expense` interface (around line 280+) and append AFTER it:

```typescript
export type StoreLoanDirection = 'lent_out' | 'borrowed_in'
export type StoreLoanStatus = 'pending' | 'returned' | 'converted_to_invoice'

export interface StoreLoan {
  id: string
  direction: StoreLoanDirection
  store_name: string
  person_name: string
  product_name: string
  quantity: number
  price: number | null
  loan_date: string
  expected_return_date: string | null
  returned_date: string | null
  status: StoreLoanStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Create `actions/store-loans.ts`**

```typescript
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
```

- [ ] **Step 3: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts actions/store-loans.ts
git commit -m "feat(store-loans): types + server actions (CRUD + stats)"
```

---

## Task 3: Dashboard Redesign

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

The goal: remove the "Outstanding Customer Dues" table, "Recent Invoices" table. Replace them with a compact 2-card row (Today's Invoices + Pending Invoices). Remove the `getRecentInvoices` import since we no longer need that data.

- [ ] **Step 1: Replace `app/(dashboard)/dashboard/page.tsx`**

Read current file first, then replace with:

```typescript
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Truck,
  FileText,
  CheckCircle2,
  CalendarIcon,
  ClockIcon,
} from 'lucide-react'
import { getInvoiceStats, getRecentDueInvoices } from '@/actions/invoices'
import { getSupplierDueStats, getRecentDueSupplierInvoices } from '@/actions/supplier-invoices'
import { getStoreLoanStats } from '@/actions/store-loans'
import { LowStockWidget } from '@/components/dashboard/LowStockWidget'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ExpensesWidget } from '@/components/dashboard/ExpensesWidget'
import { StoreLoansWidget } from '@/components/dashboard/StoreLoansWidget'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function DashboardPage() {
  const [stats, dueInvoices, supplierDueStats, dueSupplierInvoices, chartData, loanStats] = await Promise.all([
    getInvoiceStats(),
    getRecentDueInvoices(),
    getSupplierDueStats(),
    getRecentDueSupplierInvoices(),
    import('@/actions/invoices').then(m => m.getDashboardRevenueChart(30)),
    getStoreLoanStats(),
  ])

  return (
    <div className="space-y-6 pb-12">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back — here&apos;s your business overview</p>
        </div>
        <Link href="/billing">
          <button className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150">
            <ShoppingCart className="size-4" />
            New Sale
          </button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* Today's Sales */}
        <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-[#111827] text-white rounded-xl p-2 mb-3">
            <ShoppingCart className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today&apos;s Sales</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatINR(stats.todayRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.todayCount} {stats.todayCount === 1 ? 'invoice' : 'invoices'} today</p>
          <Link href="/invoices" className="text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-3 inline-block transition-colors">
            View invoices →
          </Link>
        </div>

        {/* Total Revenue */}
        <div className="bg-[#111827] rounded-2xl p-6 ring-1 ring-[#1F2937] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-xl p-2 mb-3">
            <TrendingUp className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-white mt-2">₹{formatINR(stats.totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">₹{formatINR(stats.totalPaid)} collected</p>
          <Link href="/invoices" className="text-xs font-medium text-slate-400 hover:text-white hover:underline mt-3 inline-block transition-colors">
            View all →
          </Link>
        </div>

        {/* Due from Customers */}
        <div className="bg-rose-50 rounded-2xl p-6 ring-1 ring-rose-100 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-rose-600 text-white rounded-xl p-2 mb-3">
            <AlertCircle className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Due from Customers</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatINR(stats.totalDue)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.dueCount} {stats.dueCount === 1 ? 'invoice' : 'invoices'} pending</p>
          <Link href="/invoices?status=pending" className="text-xs font-medium text-rose-600 hover:underline mt-3 inline-block transition-colors">
            Collect dues →
          </Link>
        </div>

        {/* Due to Suppliers */}
        <div className="bg-[#1F2937] rounded-2xl p-6 ring-1 ring-[#374151] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-xl p-2 mb-3">
            <Truck className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Due to Suppliers</p>
          <p className="text-2xl font-bold text-white mt-2">₹{formatINR(supplierDueStats.totalDue)}</p>
          <p className="text-xs text-slate-400 mt-1">{supplierDueStats.dueCount} {supplierDueStats.dueCount === 1 ? 'invoice' : 'invoices'} unpaid</p>
          <Link href="/stock-in" className="text-xs font-medium text-slate-400 hover:text-white hover:underline mt-3 inline-block transition-colors">
            Pay suppliers →
          </Link>
        </div>

        {/* Total Invoices */}
        <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-[#F3F4F6] text-[#4B5563] rounded-xl p-2 mb-3">
            <FileText className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalInvoices}</p>
          <p className="text-xs text-slate-500 mt-1">All time</p>
          <Link href="/invoices" className="text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-3 inline-block transition-colors">
            View all →
          </Link>
        </div>

      </div>

      {/* Invoice Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 ring-1 ring-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CalendarIcon className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Today&apos;s Invoices</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.todayCount} invoices · ₹{formatINR(stats.todayRevenue)}</p>
            </div>
          </div>
          <Link href="/invoices" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111827] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
            View →
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-5 ring-1 ring-rose-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
              <ClockIcon className="size-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Pending Invoices</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.dueCount} pending · ₹{formatINR(stats.totalDue)} due</p>
            </div>
          </div>
          <Link href="/invoices?status=pending" className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors">
            View →
          </Link>
        </div>
      </div>

      {/* Store Loans Widget */}
      <StoreLoansWidget stats={loanStats} />

      {/* Revenue Trend Chart */}
      <RevenueChart
        data={chartData}
        totalRevenue={chartData.reduce((s, d) => s + d.revenue, 0)}
        days={30}
      />

      {/* Low Stock Alerts */}
      <LowStockWidget />

      {/* Expenses This Month */}
      <ExpensesWidget />

      {/* Outstanding Customer Dues */}
      {dueInvoices.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                {stats.dueCount}
              </span>
              <h2 className="font-semibold text-slate-900">Outstanding Customer Dues</h2>
            </div>
            <Link href="/invoices?status=pending" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Paid</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-red-400 uppercase tracking-wide">Due</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dueInvoices.map((inv) => {
                  const due = Number(inv.grand_total) - Number(inv.amount_paid)
                  return (
                    <tr key={inv.id} className="row-hover">
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{inv.invoice_no}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 text-sm">{inv.customers?.name ?? 'Walk-in'}</p>
                        {inv.customers?.phone && <p className="text-xs text-slate-400">{inv.customers.phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                        {format(parseISO(inv.created_at), 'd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700">₹{formatINR(Number(inv.grand_total))}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-emerald-600 hidden md:table-cell">₹{formatINR(Number(inv.amount_paid))}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="bg-red-50 text-red-700 font-bold text-sm px-2 py-0.5 rounded-full">₹{formatINR(due)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/invoices/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">View</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Supplier Payments */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-xs font-bold">
              {supplierDueStats.dueCount}
            </span>
            <h2 className="font-semibold text-slate-900">Pending Supplier Payments</h2>
          </div>
          <Link href="/stock-in" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">
            View all
          </Link>
        </div>
        {dueSupplierInvoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-700 font-semibold text-sm">All cleared!</p>
            <p className="text-slate-500 text-xs mt-1">No pending supplier payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dueSupplierInvoices.map((inv) => (
                  <tr key={inv.id} className="row-hover">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{inv.purchase_invoice_no ?? '—'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 text-sm">{inv.supplier_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                      {format(parseISO(inv.purchase_date), 'd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-slate-900 font-bold text-sm">₹{formatINR(Number(inv.total_amount))}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        inv.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/stock-in/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">Pay</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
```

**NOTE on `getDashboardRevenueChart`:** The existing dashboard calls `getDashboardRevenueChart` imported directly at the top. Keep doing the same — just import it normally:
```typescript
import { getInvoiceStats, getRecentDueInvoices, getDashboardRevenueChart } from '@/actions/invoices'
```
Remove the dynamic `import('@/actions/invoices').then(...)` approach shown above — use the direct import. The `Promise.all` should be:
```typescript
const [stats, dueInvoices, supplierDueStats, dueSupplierInvoices, chartData, loanStats] = await Promise.all([
  getInvoiceStats(),
  getRecentDueInvoices(),
  getSupplierDueStats(),
  getRecentDueSupplierInvoices(),
  getDashboardRevenueChart(30),
  getStoreLoanStats(),
])
```

- [ ] **Step 2: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors (StoreLoansWidget import will error until Task 4 is done — create a stub first if needed).

- [ ] **Step 3: Commit** (after Task 4 widget is done)

Commit together with Task 4.

---

## Task 4: StoreLoansWidget Component

**Files:**
- Create: `components/dashboard/StoreLoansWidget.tsx`

- [ ] **Step 1: Create the widget**

```typescript
import Link from 'next/link'
import { ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'
import type { StoreLoanStats } from '@/actions/store-loans'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface StoreLoansWidgetProps {
  stats: StoreLoanStats
}

export function StoreLoansWidget({ stats }: StoreLoansWidgetProps) {
  const hasAny = stats.lent_out_pending_count > 0 || stats.borrowed_in_pending_count > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* Lent Out Card */}
      <div className="bg-amber-50 rounded-2xl p-5 ring-1 ring-amber-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ArrowUpRightIcon className="size-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Lent Out</p>
              <p className="text-xs text-amber-700 mt-0.5">Items we gave to other stores</p>
            </div>
          </div>
          <Link
            href="/store-loans?direction=lent_out"
            className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            View
          </Link>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black text-amber-900">{stats.lent_out_pending_count}</p>
            <p className="text-xs text-amber-700 mt-0.5">pending returns</p>
          </div>
          {stats.lent_out_pending_value > 0 && (
            <div className="text-right">
              <p className="text-base font-bold text-amber-800">₹{formatINR(stats.lent_out_pending_value)}</p>
              <p className="text-xs text-amber-600">est. value</p>
            </div>
          )}
        </div>
        {stats.lent_out_pending_count === 0 && (
          <p className="mt-3 text-xs text-amber-600 font-medium">No pending lent items</p>
        )}
      </div>

      {/* Borrowed In Card */}
      <div className="bg-blue-50 rounded-2xl p-5 ring-1 ring-blue-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ArrowDownLeftIcon className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Borrowed In</p>
              <p className="text-xs text-blue-700 mt-0.5">Items we took from other stores</p>
            </div>
          </div>
          <Link
            href="/store-loans?direction=borrowed_in"
            className="text-xs font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            View
          </Link>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black text-blue-900">{stats.borrowed_in_pending_count}</p>
            <p className="text-xs text-blue-700 mt-0.5">pending returns</p>
          </div>
          {stats.borrowed_in_pending_value > 0 && (
            <div className="text-right">
              <p className="text-base font-bold text-blue-800">₹{formatINR(stats.borrowed_in_pending_value)}</p>
              <p className="text-xs text-blue-600">est. value</p>
            </div>
          )}
        </div>
        {stats.borrowed_in_pending_count === 0 && (
          <p className="mt-3 text-xs text-blue-600 font-medium">No borrowed items pending</p>
        )}
      </div>

    </div>
  )
}
```

- [ ] **Step 2: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit Tasks 3+4 together**

```bash
git add app/(dashboard)/dashboard/page.tsx components/dashboard/StoreLoansWidget.tsx
git commit -m "feat(dashboard): remove invoice tables → compact cards + store loans widget"
```

---

## Task 5: Store Loans List Page

**Files:**
- Create: `app/(dashboard)/store-loans/page.tsx`

- [ ] **Step 1: Create the list page**

```typescript
import { getStoreLoans } from '@/actions/store-loans'
import Link from 'next/link'
import { PlusIcon, ArrowUpRightIcon, ArrowDownLeftIcon, CheckCircle2Icon, ClockIcon } from 'lucide-react'
import type { StoreLoanDirection, StoreLoanStatus } from '@/types/database'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const DIRECTION_LABEL: Record<StoreLoanDirection, string> = {
  lent_out: 'Lent Out',
  borrowed_in: 'Borrowed In',
}

const STATUS_STYLES: Record<StoreLoanStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  returned: 'bg-emerald-50 text-emerald-700',
  converted_to_invoice: 'bg-blue-50 text-blue-700',
}

const STATUS_LABELS: Record<StoreLoanStatus, string> = {
  pending: 'Pending',
  returned: 'Returned',
  converted_to_invoice: 'Invoiced',
}

export default async function StoreLoansPage({
  searchParams,
}: {
  searchParams: { direction?: string; status?: string }
}) {
  const direction = (searchParams.direction as StoreLoanDirection) || undefined
  const status = (searchParams.status as StoreLoanStatus) || undefined

  const loans = await getStoreLoans({ direction, status })

  const pendingCount = loans.filter(l => l.status === 'pending').length
  const returnedCount = loans.filter(l => l.status === 'returned').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store Loans</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inter-store item lending &amp; borrowing</p>
        </div>
        <Link
          href="/store-loans/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] text-white rounded-xl text-sm font-semibold hover:bg-[#1F2937] transition-colors"
        >
          <PlusIcon className="size-4" />
          Record Loan
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', href: '/store-loans' },
          { label: 'Lent Out', href: '/store-loans?direction=lent_out' },
          { label: 'Borrowed In', href: '/store-loans?direction=borrowed_in' },
          { label: 'Pending', href: '/store-loans?status=pending' },
          { label: 'Returned', href: '/store-loans?status=returned' },
        ].map(tab => {
          const isActive =
            tab.href === '/store-loans'
              ? !direction && !status
              : tab.href.includes('direction=lent_out') ? direction === 'lent_out'
              : tab.href.includes('direction=borrowed_in') ? direction === 'borrowed_in'
              : tab.href.includes('status=pending') ? status === 'pending'
              : status === 'returned'
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#111827] text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {loans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <ArrowUpRightIcon className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No loans recorded</p>
          <p className="text-sm text-slate-400 mt-1">Click &quot;Record Loan&quot; to add the first entry</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Direction</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Store</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">Person</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">Qty</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">Price</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.map(loan => (
                <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(loan.loan_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      loan.direction === 'lent_out' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {loan.direction === 'lent_out'
                        ? <ArrowUpRightIcon className="size-3" />
                        : <ArrowDownLeftIcon className="size-3" />
                      }
                      {DIRECTION_LABEL[loan.direction]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-900">{loan.store_name}</td>
                  <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">{loan.person_name}</td>
                  <td className="px-4 py-3.5 text-slate-700">{loan.product_name}</td>
                  <td className="px-4 py-3.5 text-right text-slate-600 hidden md:table-cell">{loan.quantity}</td>
                  <td className="px-4 py-3.5 text-right text-slate-700 font-medium hidden md:table-cell">
                    {loan.price != null ? `₹${formatINR(Number(loan.price))}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[loan.status]}`}>
                      {STATUS_LABELS[loan.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/store-loans/${loan.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">
                      View
                    </Link>
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

- [ ] **Step 2: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/store-loans/page.tsx
git commit -m "feat(store-loans): list page with direction/status filters"
```

---

## Task 6: New Store Loan Form

**Files:**
- Create: `components/store-loans/StoreLoanForm.tsx`
- Create: `app/(dashboard)/store-loans/new/page.tsx`

- [ ] **Step 1: Create `components/store-loans/StoreLoanForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStoreLoan, type CreateStoreLoanData } from '@/actions/store-loans'
import type { StoreLoanDirection } from '@/types/database'

export function StoreLoanForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateStoreLoanData>({
    direction: 'lent_out',
    store_name: '',
    person_name: '',
    product_name: '',
    quantity: 1,
    price: null,
    loan_date: new Date().toISOString().slice(0, 10),
    expected_return_date: null,
    notes: null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.store_name.trim()) { toast.error('Enter store name'); return }
    if (!form.person_name.trim()) { toast.error('Enter person name'); return }
    if (!form.product_name.trim()) { toast.error('Enter product name'); return }
    if (form.quantity < 1) { toast.error('Quantity must be at least 1'); return }
    setLoading(true)
    try {
      const loan = await createStoreLoan(form)
      toast.success('Loan recorded')
      router.push(`/store-loans/${loan.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const directionOptions: { value: StoreLoanDirection; label: string; desc: string }[] = [
    { value: 'lent_out', label: 'Lent Out', desc: 'We gave an item to another store — they will return it' },
    { value: 'borrowed_in', label: 'Borrowed In', desc: 'We took an item from another store — we will return it' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">

      {/* Direction */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Direction</label>
        <div className="grid grid-cols-2 gap-3">
          {directionOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, direction: opt.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                form.direction === opt.value
                  ? opt.value === 'lent_out'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className={`text-sm font-semibold ${
                form.direction === opt.value
                  ? opt.value === 'lent_out' ? 'text-amber-800' : 'text-blue-800'
                  : 'text-slate-700'
              }`}>{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Store + Person */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            {form.direction === 'lent_out' ? 'Their Store Name' : 'Source Store Name'}
          </label>
          <input
            type="text"
            value={form.store_name}
            onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
            placeholder="e.g. SR Store, City Camera"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Person Name</label>
          <input
            type="text"
            value={form.person_name}
            onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
            placeholder="Who came / who you went to"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
      </div>

      {/* Product */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Product / Item</label>
        <input
          type="text"
          value={form.product_name}
          onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
          placeholder="e.g. Canon 50mm f/1.8, Sony A7 III body"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          required
        />
      </div>

      {/* Qty + Price */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Qty</label>
          <input
            type="number"
            min={1}
            step={1}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
            onFocus={e => e.target.select()}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Price (₹) <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.price ?? ''}
            onChange={e => setForm(f => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : null }))}
            onFocus={e => e.target.select()}
            placeholder="Estimated item value"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Loan Date</label>
          <input
            type="date"
            value={form.loan_date}
            onChange={e => setForm(f => ({ ...f, loan_date: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Expected Return <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={form.expected_return_date ?? ''}
            onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value || null }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.notes ?? ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
          placeholder="Any additional details..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-semibold hover:bg-[#1F2937] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Record Loan'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/store-loans/new/page.tsx`**

```typescript
import { StoreLoanForm } from '@/components/store-loans/StoreLoanForm'

export default function NewStoreLoanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Loan</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track an item lent to or borrowed from another store</p>
      </div>
      <StoreLoanForm />
    </div>
  )
}
```

- [ ] **Step 3: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/store-loans/StoreLoanForm.tsx app/(dashboard)/store-loans/new/page.tsx
git commit -m "feat(store-loans): new loan form + page"
```

---

## Task 7: Store Loan Detail Page

**Files:**
- Create: `app/(dashboard)/store-loans/[id]/page.tsx`

This page shows full loan details. Has two action buttons: "Mark Returned" (if pending) and "Delete".

- [ ] **Step 1: Create `components/store-loans/LoanActions.tsx` (client component for actions)**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { markLoanReturned, deleteStoreLoan } from '@/actions/store-loans'
import type { StoreLoan } from '@/types/database'

interface LoanActionsProps {
  loan: StoreLoan
}

export function LoanActions({ loan }: LoanActionsProps) {
  const router = useRouter()
  const [markingReturned, setMarkingReturned] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleMarkReturned() {
    setMarkingReturned(true)
    try {
      await markLoanReturned(loan.id)
      toast.success('Marked as returned')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setMarkingReturned(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this loan record? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteStoreLoan(loan.id)
      toast.success('Loan deleted')
      router.push('/store-loans')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {loan.status === 'pending' && (
        <button
          onClick={handleMarkReturned}
          disabled={markingReturned}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {markingReturned ? 'Updating...' : '✓ Mark as Returned'}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/store-loans/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStoreLoan } from '@/actions/store-loans'
import { LoanActions } from '@/components/store-loans/LoanActions'
import { ArrowLeftIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function StoreLoanDetailPage({ params }: { params: { id: string } }) {
  const loan = await getStoreLoan(params.id)
  if (!loan) notFound()

  const isLentOut = loan.direction === 'lent_out'
  const overdue = loan.status === 'pending' && loan.expected_return_date
    ? new Date(loan.expected_return_date) < new Date()
    : false

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/store-loans" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeftIcon className="size-3.5" /> Store Loans
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{loan.product_name}</h1>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              isLentOut ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isLentOut ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownLeftIcon className="size-3" />}
              {isLentOut ? 'Lent Out' : 'Borrowed In'}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{loan.store_name} · {loan.person_name}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
          loan.status === 'pending'
            ? overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            : loan.status === 'returned' ? 'bg-emerald-100 text-emerald-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {loan.status === 'pending' && overdue ? 'Overdue' : loan.status.charAt(0).toUpperCase() + loan.status.slice(1).replace(/_/g, ' ')}
        </span>
      </div>

      {/* Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Store</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.store_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Person</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.person_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Product</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.product_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Quantity</p>
            <p className="font-semibold text-slate-900 mt-0.5">{loan.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Price</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {loan.price != null ? `₹${formatINR(Number(loan.price))}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Loan Date</p>
            <p className="font-semibold text-slate-900 mt-0.5">{formatDate(loan.loan_date)}</p>
          </div>
          {loan.expected_return_date && (
            <div>
              <p className="text-xs text-slate-500">Expected Return</p>
              <p className={`font-semibold mt-0.5 ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
                {formatDate(loan.expected_return_date)}
                {overdue && ' (Overdue)'}
              </p>
            </div>
          )}
          {loan.returned_date && (
            <div>
              <p className="text-xs text-slate-500">Returned On</p>
              <p className="font-semibold text-emerald-700 mt-0.5">{formatDate(loan.returned_date)}</p>
            </div>
          )}
        </div>

        {loan.notes && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">Notes</p>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{loan.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <LoanActions loan={loan} />
    </div>
  )
}
```

- [ ] **Step 3: TypeCheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/store-loans/LoanActions.tsx app/(dashboard)/store-loans/[id]/page.tsx
git commit -m "feat(store-loans): detail page with mark-returned + delete actions"
```

---

## Task 8: Sidebar Nav + Final Lint/Build

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Store Loans to Sidebar**

In `Sidebar.tsx`, add `ArrowLeftRight` to the lucide-react import line:
```typescript
import {
  LayoutDashboard, Package, PackagePlus, ShoppingCart,
  FileText, Users, Tag, BarChart3, FileDown, Settings,
  ClipboardList, Menu, X, Truck, SlidersHorizontal, RotateCcw, ClipboardCheck, Receipt, ArrowLeftRight
} from 'lucide-react'
```

Add the nav item to `navItems` array, after Expenses:
```typescript
{ label: 'Store Loans', href: '/store-loans', icon: ArrowLeftRight },
```

- [ ] **Step 2: Run typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 0 errors on both.

- [ ] **Step 3: Final commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(nav): add Store Loans to sidebar"
```

---

## Self-Review

### Spec Coverage
| Requirement | Task |
|-------------|------|
| Remove today's invoices table from dashboard | Task 3 |
| Remove pending invoices table from dashboard | Task 3 |
| Show them as cards with View option | Task 3 — "Invoice Quick Access Cards" section |
| Dashboard cards for Lent Out + Borrowed In | Tasks 3+4 (StoreLoansWidget) |
| Store name field | Task 6 (StoreLoanForm) |
| Product name field | Task 6 |
| Date field | Task 6 |
| Person name field | Task 6 |
| Price field | Task 6 |
| Notes field | Task 6 |
| Record who brought it | Task 6 (person_name) |
| Both directions (lent out + borrowed in) | Tasks 1–7, direction enum |
| Mark item returned | Task 7 (LoanActions) |
| Full list view + filters | Task 5 |
| Detail view per loan | Task 7 |
| Sidebar nav link | Task 8 |

### Type Consistency
- `StoreLoan` defined in Task 2 (`types/database.ts`) — used in Tasks 5, 6, 7 ✅
- `StoreLoanStats` defined in Task 2 (`actions/store-loans.ts`) — used in Task 4 widget ✅
- `CreateStoreLoanData` defined in Task 2 — used in Task 6 form ✅
- `markLoanReturned(id)` defined in Task 2 — used in Task 7 LoanActions ✅
- `deleteStoreLoan(id)` defined in Task 2 — used in Task 7 LoanActions ✅

### No Placeholders
All steps contain actual code. No TBDs. ✅
