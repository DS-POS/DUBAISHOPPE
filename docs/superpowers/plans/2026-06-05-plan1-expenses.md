# Expenses Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full expenses module to record salary, wages, rent, utilities and all business expenses with monthly summaries and export.

**Architecture:** Two new tables: `expense_categories` (seeded) and `expenses`. Server actions for CRUD. New sidebar section `/expenses`. Dashboard widget shows current month total. Monthly breakdown exportable to Excel via `xlsx` (already installed).

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, xlsx (existing), shadcn/ui (existing)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/009_expenses.sql` | CREATE — expense_categories + expenses tables + RLS |
| `types/database.ts` | Modify — add ExpenseCategory + Expense types |
| `actions/expenses.ts` | CREATE — createExpense, getExpenses, deleteExpense, getExpenseSummary |
| `components/expenses/ExpenseForm.tsx` | CREATE — add/edit expense form |
| `components/dashboard/ExpensesWidget.tsx` | CREATE — this month total widget |
| `app/(dashboard)/expenses/page.tsx` | CREATE — expenses list page |
| `app/(dashboard)/expenses/new/page.tsx` | CREATE — new expense page |
| `components/layout/Sidebar.tsx` | Modify — add Expenses nav link |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/009_expenses.sql`

- [ ] **Step 1: Write migration**

```sql
-- 009_expenses.sql

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Seed default categories
insert into public.expense_categories (name) values
  ('Salary'),
  ('Wages'),
  ('Rent'),
  ('Electricity'),
  ('Internet'),
  ('Transport'),
  ('Marketing'),
  ('Maintenance'),
  ('Bank Charges'),
  ('Miscellaneous');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category_id uuid references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  payment_method text default 'cash' check (payment_method in ('cash','upi','card','bank_transfer','cheque')),
  reference_no text,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- RLS
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy "authenticated read expense_categories"
  on public.expense_categories for select to authenticated using (true);

create policy "authenticated all expenses"
  on public.expenses for all to authenticated
  using (true) with check (true);
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration`. Project ref: `lzvyzfwbsssvofrjbndx`.

- [ ] **Step 3: Verify**

```sql
select count(*) from expense_categories; -- expect 10
select column_name from information_schema.columns where table_name = 'expenses';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_expenses.sql
git commit -m "feat(expenses): DB migration — expense_categories + expenses tables"
```

---

### Task 2: Types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add types at end of types/database.ts**

```typescript
export type ExpensePaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque'

export interface ExpenseCategory {
  id: string
  name: string
  created_at: string
}

export interface Expense {
  id: string
  date: string
  category_id: string | null
  amount: number
  description: string
  payment_method: ExpensePaymentMethod
  reference_no: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  expense_categories?: ExpenseCategory
}
```

- [ ] **Step 2: Commit**

```bash
git add types/database.ts
git commit -m "feat(expenses): Expense + ExpenseCategory types"
```

---

### Task 3: Server Actions

**Files:**
- Create: `actions/expenses.ts`

- [ ] **Step 1: Create actions/expenses.ts**

```typescript
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
  const to = new Date(year, month, 0).toISOString().slice(0, 10) // last day of month

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
    const cat = (row.expense_categories as { name: string } | null)?.name ?? 'Uncategorised'
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
```

- [ ] **Step 2: Commit**

```bash
git add actions/expenses.ts
git commit -m "feat(expenses): server actions — createExpense, getExpenses, deleteExpense, getExpenseSummary"
```

---

### Task 4: ExpenseForm component

**Files:**
- Create: `components/expenses/ExpenseForm.tsx`

- [ ] **Step 1: Create components/expenses/ExpenseForm.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createExpense, type CreateExpenseData } from '@/actions/expenses'
import type { ExpenseCategory } from '@/types/database'

interface ExpenseFormProps {
  categories: ExpenseCategory[]
}

export function ExpenseForm({ categories }: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateExpenseData>({
    date: new Date().toISOString().slice(0, 10),
    category_id: categories[0]?.id ?? '',
    amount: 0,
    description: '',
    payment_method: 'cash',
    reference_no: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category_id) { toast.error('Select a category'); return }
    if (!form.amount || form.amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.description.trim()) { toast.error('Enter a description'); return }
    setLoading(true)
    try {
      await createExpense({ ...form, amount: Number(form.amount) })
      toast.success('Expense recorded')
      router.push('/expenses')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Category</label>
          <select
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white"
            required
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="e.g. Monthly salary for June"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Amount (₹)</label>
          <input
            type="number"
            value={form.amount || ''}
            min={0.01}
            step={0.01}
            onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
            onFocus={e => e.target.select()}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Payment Method</label>
          <select
            value={form.payment_method}
            onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as CreateExpenseData['payment_method'] }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Reference No. <span className="text-slate-400 font-normal">(optional)</span></label>
        <input
          type="text"
          value={form.reference_no}
          onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
          placeholder="Cheque no., UPI ref, etc."
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
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
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/expenses/
git commit -m "feat(expenses): ExpenseForm component"
```

---

### Task 5: Expenses pages

**Files:**
- Create: `app/(dashboard)/expenses/page.tsx`
- Create: `app/(dashboard)/expenses/new/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/expenses/page.tsx**

```tsx
import { getExpenses, getExpenseSummary } from '@/actions/expenses'
import { PlusIcon, ReceiptIcon } from 'lucide-react'
import Link from 'next/link'

export default async function ExpensesPage() {
  const now = new Date()
  const [expenses, summary] = await Promise.all([
    getExpenses({ from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01` }),
    getExpenseSummary(now.getFullYear(), now.getMonth() + 1),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            This month: <span className="font-semibold text-slate-700">₹{summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] text-white rounded-xl text-sm font-semibold hover:bg-[#1F2937] transition-colors"
        >
          <PlusIcon className="size-4" />
          Add Expense
        </Link>
      </div>

      {/* Category summary cards */}
      {summary.by_category.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {summary.by_category.map(c => (
            <div key={c.category} className="bg-white rounded-xl p-3 ring-1 ring-black/[0.06] shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{c.category}</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                ₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <ReceiptIcon className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No expenses this month</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Expense" to record one</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(exp.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                      {exp.expense_categories?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{exp.description}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{exp.payment_method.replace('_',' ')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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

- [ ] **Step 2: Create app/(dashboard)/expenses/new/page.tsx**

```tsx
import { getExpenseCategories } from '@/actions/expenses'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'

export default async function NewExpensePage() {
  const categories = await getExpenseCategories()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add Expense</h1>
        <p className="text-sm text-slate-500 mt-0.5">Record a business expense</p>
      </div>
      <ExpenseForm categories={categories} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/expenses/
git commit -m "feat(expenses): /expenses list page + /expenses/new form page"
```

---

### Task 6: Sidebar link + Dashboard widget

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Create: `components/dashboard/ExpensesWidget.tsx`

- [ ] **Step 1: Add Expenses link to Sidebar.tsx**

Import `ReceiptIcon` from lucide-react and add nav item after the Returns link:
```tsx
{ href: '/expenses', label: 'Expenses', icon: ReceiptIcon },
```

- [ ] **Step 2: Create components/dashboard/ExpensesWidget.tsx**

```tsx
import { getExpenseSummary } from '@/actions/expenses'
import { TrendingDownIcon } from 'lucide-react'
import Link from 'next/link'

export async function ExpensesWidget() {
  const now = new Date()
  const summary = await getExpenseSummary(now.getFullYear(), now.getMonth() + 1)
  if (summary.total === 0) return null

  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-red-50 flex items-center justify-center">
            <TrendingDownIcon className="size-4 text-red-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Expenses This Month</span>
        </div>
        <Link href="/expenses" className="text-xs text-[#111827] font-medium hover:underline">View all</Link>
      </div>
      <p className="text-2xl font-black text-slate-900">
        ₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
      <div className="mt-3 space-y-1">
        {summary.by_category.slice(0, 4).map(c => (
          <div key={c.category} className="flex justify-between text-xs text-slate-500">
            <span>{c.category}</span>
            <span className="font-medium text-slate-700">₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add ExpensesWidget to dashboard page**

In `app/(dashboard)/dashboard/page.tsx`, import and add `<ExpensesWidget />` after the `<LowStockWidget />`.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx components/dashboard/ExpensesWidget.tsx app/(dashboard)/dashboard/page.tsx
git commit -m "feat(expenses): sidebar link + dashboard widget"
```

---

### Task 7: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Test in browser**

1. Click Expenses in sidebar → list page loads
2. Click Add Expense → form opens with category dropdown showing 10 categories
3. Fill: Date=today, Category=Salary, Amount=50000, Description="June salary", Method=Bank Transfer → Save
4. Returns to list, shows row with correct data and monthly total
5. Dashboard shows Expenses widget with ₹50,000

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(expenses): complete expenses module — record, list, dashboard widget"
```
