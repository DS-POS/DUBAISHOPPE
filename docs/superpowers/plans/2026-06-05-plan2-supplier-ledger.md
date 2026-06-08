# Supplier Ledger (Accounts Payable) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full supplier ledger — see all invoices + payments + running balance per supplier, payable aging (0-30/31-60/61-90/90+ days), and printable/exportable supplier credit statement.

**Architecture:** Add `due_date` and `supplier_id` FK to `supplier_invoices`. New server action `getSupplierLedger` returns chronological list with running balance. New pages: `/suppliers/[id]/ledger` and `/reports/payables`. Export via `xlsx`.

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, xlsx (existing)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/010_supplier_ledger.sql` | CREATE — add due_date + supplier_id to supplier_invoices |
| `types/database.ts` | Modify — add due_date + supplier_id to SupplierInvoice |
| `actions/supplier-invoices.ts` | Modify — add getSupplierLedger, getPayablesAging |
| `components/suppliers/SupplierLedgerTable.tsx` | CREATE — ledger table with running balance |
| `components/suppliers/LedgerExportButton.tsx` | CREATE — Excel export button |
| `app/(dashboard)/suppliers/[id]/ledger/page.tsx` | CREATE — per-supplier ledger page |
| `app/(dashboard)/reports/payables/page.tsx` | CREATE — all-suppliers AP aging report |
| `app/(dashboard)/suppliers/[id]/page.tsx` | Modify — add "Ledger" button |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/010_supplier_ledger.sql`

- [ ] **Step 1: Write migration**

```sql
-- 010_supplier_ledger.sql

-- Add due_date to supplier_invoices (payment due date)
alter table public.supplier_invoices
  add column if not exists due_date date,
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists notes text;

-- Index for fast per-supplier queries
create index if not exists idx_supplier_invoices_supplier_id
  on public.supplier_invoices(supplier_id);
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration`. Project ref: `lzvyzfwbsssvofrjbndx`.

- [ ] **Step 3: Verify**

```sql
select column_name from information_schema.columns
where table_name = 'supplier_invoices'
  and column_name in ('due_date','supplier_id','notes');
-- expect 3 rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_supplier_ledger.sql
git commit -m "feat(supplier-ledger): add due_date + supplier_id + notes to supplier_invoices"
```

---

### Task 2: Types update

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Update SupplierInvoice interface**

Add these fields to the `SupplierInvoice` interface:
```typescript
supplier_id: string | null
due_date: string | null
notes: string | null
suppliers?: Pick<Supplier, 'id' | 'name' | 'phone' | 'gstin'>
```

- [ ] **Step 2: Commit**

```bash
git add types/database.ts
git commit -m "feat(supplier-ledger): add supplier_id + due_date + notes to SupplierInvoice type"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `actions/supplier-invoices.ts`

- [ ] **Step 1: Add getSupplierLedger to actions/supplier-invoices.ts**

Append to the existing file:
```typescript
export interface LedgerTransaction {
  id: string
  date: string
  type: 'invoice' | 'payment'
  reference: string
  description: string
  debit: number    // invoice amount (we owe them)
  credit: number   // payment made (reduces balance)
  balance: number  // running balance (positive = we owe)
}

export interface SupplierLedger {
  supplier_id: string
  supplier_name: string
  transactions: LedgerTransaction[]
  total_invoiced: number
  total_paid: number
  closing_balance: number
}

export async function getSupplierLedger(supplierId: string): Promise<SupplierLedger> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('id', supplierId)
    .single()

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('*, supplier_payments(*)')
    .eq('supplier_id', supplierId)
    .order('purchase_date', { ascending: true })

  const rows: LedgerTransaction[] = []
  let balance = 0

  for (const inv of (invoices ?? [])) {
    balance += Number(inv.total_amount)
    rows.push({
      id: inv.id,
      date: inv.purchase_date,
      type: 'invoice',
      reference: inv.purchase_invoice_no ?? inv.id.slice(0, 8),
      description: `Invoice received`,
      debit: Number(inv.total_amount),
      credit: 0,
      balance,
    })
    for (const pmt of (inv.supplier_payments ?? [])) {
      balance -= Number(pmt.amount)
      rows.push({
        id: pmt.id,
        date: pmt.payment_date,
        type: 'payment',
        reference: pmt.payment_reference ?? '—',
        description: `Payment (${pmt.payment_method ?? ''})`,
        debit: 0,
        credit: Number(pmt.amount),
        balance,
      })
    }
  }

  // Sort all rows chronologically
  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Recompute running balance in sorted order
  let runningBalance = 0
  for (const row of rows) {
    runningBalance += row.debit - row.credit
    row.balance = runningBalance
  }

  const total_invoiced = rows.filter(r => r.type === 'invoice').reduce((s, r) => s + r.debit, 0)
  const total_paid = rows.filter(r => r.type === 'payment').reduce((s, r) => s + r.credit, 0)

  return {
    supplier_id: supplierId,
    supplier_name: supplier?.name ?? 'Unknown',
    transactions: rows,
    total_invoiced,
    total_paid,
    closing_balance: total_invoiced - total_paid,
  }
}
```

- [ ] **Step 2: Add getPayablesAging**

Append:
```typescript
export interface PayableAging {
  supplier_id: string | null
  supplier_name: string
  current: number    // 0-30 days
  days_31_60: number
  days_61_90: number
  over_90: number
  total_due: number
}

export async function getPayablesAging(): Promise<PayableAging[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('*, supplier_payments(*)')
    .neq('payment_status', 'paid')
    .order('purchase_date', { ascending: true })

  const today = new Date()
  const bySupplier: Record<string, PayableAging> = {}

  for (const inv of (invoices ?? [])) {
    const key = inv.supplier_name ?? 'Unknown'
    if (!bySupplier[key]) {
      bySupplier[key] = { supplier_id: inv.supplier_id ?? null, supplier_name: key, current: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total_due: 0 }
    }
    const paid = (inv.supplier_payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
    const outstanding = Number(inv.total_amount) - paid
    if (outstanding <= 0) continue

    const invoiceDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.purchase_date)
    const ageDays = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))

    const entry = bySupplier[key]
    if (ageDays <= 30) entry.current += outstanding
    else if (ageDays <= 60) entry.days_31_60 += outstanding
    else if (ageDays <= 90) entry.days_61_90 += outstanding
    else entry.over_90 += outstanding
    entry.total_due += outstanding
  }

  return Object.values(bySupplier).filter(s => s.total_due > 0).sort((a, b) => b.total_due - a.total_due)
}
```

- [ ] **Step 3: Commit**

```bash
git add actions/supplier-invoices.ts
git commit -m "feat(supplier-ledger): getSupplierLedger + getPayablesAging actions"
```

---

### Task 4: SupplierLedgerTable + Export

**Files:**
- Create: `components/suppliers/SupplierLedgerTable.tsx`
- Create: `components/suppliers/LedgerExportButton.tsx`

- [ ] **Step 1: Create SupplierLedgerTable.tsx**

```tsx
import type { LedgerTransaction } from '@/actions/supplier-invoices'

interface Props {
  transactions: LedgerTransaction[]
  totalInvoiced: number
  totalPaid: number
  closingBalance: number
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export function SupplierLedgerTable({ transactions, totalInvoiced, totalPaid, closingBalance }: Props) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
      {/* Summary cards */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <div className="p-4">
          <p className="text-xs text-slate-500">Total Invoiced</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{fmt(totalInvoiced)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{fmt(totalPaid)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Balance Due</p>
          <p className={`text-lg font-bold mt-0.5 ${closingBalance > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {fmt(closingBalance)}
          </p>
        </div>
      </div>

      {/* Ledger table */}
      <table className="w-full text-sm">
        <thead className="bg-[#111827]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Reference</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Debit (₹)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Credit (₹)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Balance (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map(tx => (
            <tr key={tx.id} className={`hover:bg-slate-50 ${tx.type === 'payment' ? 'bg-emerald-50/30' : ''}`}>
              <td className="px-4 py-3 text-slate-600">
                {new Date(tx.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
              </td>
              <td className="px-4 py-3 text-slate-700 font-medium">{tx.reference}</td>
              <td className="px-4 py-3 text-slate-600">{tx.description}</td>
              <td className="px-4 py-3 text-right font-medium text-red-600">
                {tx.debit > 0 ? fmt(tx.debit) : '—'}
              </td>
              <td className="px-4 py-3 text-right font-medium text-emerald-600">
                {tx.credit > 0 ? fmt(tx.credit) : '—'}
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(tx.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create LedgerExportButton.tsx**

```tsx
'use client'

import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import type { SupplierLedger } from '@/actions/supplier-invoices'

export function LedgerExportButton({ ledger }: { ledger: SupplierLedger }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const xlsx = await import('xlsx')
      const rows = ledger.transactions.map(tx => ({
        Date: tx.date,
        Reference: tx.reference,
        Description: tx.description,
        'Debit (₹)': tx.debit || '',
        'Credit (₹)': tx.credit || '',
        'Balance (₹)': tx.balance,
      }))
      rows.push({
        Date: '',
        Reference: '',
        Description: 'CLOSING BALANCE',
        'Debit (₹)': '',
        'Credit (₹)': '',
        'Balance (₹)': ledger.closing_balance,
      })
      const ws = xlsx.utils.json_to_sheet(rows)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Ledger')
      xlsx.writeFile(wb, `${ledger.supplier_name}-ledger.xlsx`)
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
git add components/suppliers/
git commit -m "feat(supplier-ledger): SupplierLedgerTable + LedgerExportButton"
```

---

### Task 5: Supplier ledger page

**Files:**
- Create: `app/(dashboard)/suppliers/[id]/ledger/page.tsx`
- Modify: `app/(dashboard)/suppliers/[id]/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/suppliers/[id]/ledger/page.tsx**

```tsx
import { getSupplierLedger } from '@/actions/supplier-invoices'
import { SupplierLedgerTable } from '@/components/suppliers/SupplierLedgerTable'
import { LedgerExportButton } from '@/components/suppliers/LedgerExportButton'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function SupplierLedgerPage({ params }: Props) {
  const { id } = await params
  let ledger
  try {
    ledger = await getSupplierLedger(id)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/suppliers/${id}`} className="size-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <ArrowLeftIcon className="size-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ledger.supplier_name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Account Statement / Ledger</p>
          </div>
        </div>
        <LedgerExportButton ledger={ledger} />
      </div>

      {ledger.transactions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <p className="font-semibold text-slate-600">No transactions found</p>
          <p className="text-sm text-slate-400 mt-1">Link supplier invoices to this supplier to see ledger</p>
        </div>
      ) : (
        <SupplierLedgerTable
          transactions={ledger.transactions}
          totalInvoiced={ledger.total_invoiced}
          totalPaid={ledger.total_paid}
          closingBalance={ledger.closing_balance}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Ledger button to supplier detail page**

In `app/(dashboard)/suppliers/[id]/page.tsx`, add a "Ledger" link button in the header actions area:
```tsx
<Link
  href={`/suppliers/${id}/ledger`}
  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
  <BookOpenIcon className="size-4" />
  Ledger
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/suppliers/
git commit -m "feat(supplier-ledger): /suppliers/[id]/ledger page"
```

---

### Task 6: Payables aging report page

**Files:**
- Create: `app/(dashboard)/reports/payables/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/reports/payables/page.tsx**

```tsx
import { getPayablesAging } from '@/actions/supplier-invoices'
import Link from 'next/link'

const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default async function PayablesPage() {
  const aging = await getPayablesAging()
  const totals = {
    current: aging.reduce((s, a) => s + a.current, 0),
    days_31_60: aging.reduce((s, a) => s + a.days_31_60, 0),
    days_61_90: aging.reduce((s, a) => s + a.days_61_90, 0),
    over_90: aging.reduce((s, a) => s + a.over_90, 0),
    total_due: aging.reduce((s, a) => s + a.total_due, 0),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accounts Payable</h1>
        <p className="text-sm text-slate-500 mt-0.5">Supplier outstanding balances by age</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '0–30 Days', value: totals.current, color: 'text-emerald-600' },
          { label: '31–60 Days', value: totals.days_31_60, color: 'text-amber-600' },
          { label: '61–90 Days', value: totals.days_61_90, color: 'text-orange-600' },
          { label: '90+ Days', value: totals.over_90, color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {aging.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <p className="font-semibold text-slate-600">No outstanding payables</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">0–30 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">31–60 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">61–90 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">90+ Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total Due</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aging.map(row => (
                <tr key={row.supplier_name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.supplier_name}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(row.current)}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-medium">{fmt(row.days_31_60)}</td>
                  <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(row.days_61_90)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(row.over_90)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(row.total_due)}</td>
                  <td className="px-4 py-3">
                    {row.supplier_id && (
                      <Link href={`/suppliers/${row.supplier_id}/ledger`} className="text-xs text-[#111827] font-medium hover:underline">
                        Ledger →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-3 text-slate-900">Total</td>
                <td className="px-4 py-3 text-right text-emerald-700">{fmt(totals.current)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{fmt(totals.days_31_60)}</td>
                <td className="px-4 py-3 text-right text-orange-700">{fmt(totals.days_61_90)}</td>
                <td className="px-4 py-3 text-right text-red-700">{fmt(totals.over_90)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{fmt(totals.total_due)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Payables link to reports page**

In `app/(dashboard)/reports/page.tsx`, add a card/link to `/reports/payables`.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/reports/payables/ app/(dashboard)/reports/page.tsx
git commit -m "feat(supplier-ledger): /reports/payables AP aging report"
```

---

### Task 7: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Test**

1. Go to Suppliers → open a supplier → verify "Ledger" button visible
2. Click Ledger → shows transactions table with running balance
3. Click Export Excel → downloads .xlsx
4. Go to Reports → Payables → shows aging table with color-coded columns
5. "Ledger →" link in payables table navigates to supplier ledger

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(supplier-ledger): complete AP module — per-supplier ledger + payables aging"
```
