# Customer Account Statement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a full account statement for any customer — all invoices (debits) and payments (credits) in date order with a running balance — accessible from the customer detail page, exportable as Excel.

**Architecture:** `getCustomerStatement(customerId)` fetches all invoices + all payments for those invoices, sorts chronologically, and computes a running balance (invoice = debit, payment = credit). A server-rendered statement page `/customers/[id]/statement` shows this as a ledger table. Excel export uses the `xlsx` library already installed. Credit summary card already exists on the customer detail page; we add a "Statement" link to it.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind, xlsx (already installed)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `actions/customers.ts` | Modify | Add `getCustomerStatement` action |
| `app/(dashboard)/customers/[id]/statement/page.tsx` | Create | Statement page with ledger table + Excel export |
| `app/(dashboard)/customers/[id]/page.tsx` | Modify | Add "Statement" link button |

---

### Task 1: getCustomerStatement server action

**Files:**
- Modify: `actions/customers.ts`

- [ ] **Step 1: Read `actions/customers.ts`** to find the end of the file.

- [ ] **Step 2: Add types and action**

Add at the end of `actions/customers.ts`:

```typescript
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
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add actions/customers.ts
git commit -m "feat(statement): getCustomerStatement action"
```

---

### Task 2: Statement page

**Files:**
- Create: `app/(dashboard)/customers/[id]/statement/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCustomerStatement } from '@/actions/customers'
import { getCustomerById } from '@/actions/customers'
import { StatementExportButton } from '@/components/customers/StatementExportButton'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function CustomerStatementPage({ params }: { params: { id: string } }) {
  const customer = await getCustomerById(params.id)
  if (!customer) notFound()

  const statement = await getCustomerStatement(params.id)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/customers/${params.id}`} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
            ← {customer.name}
          </Link>
          <h1 className="text-2xl font-bold text-[#111827]">Account Statement</h1>
          <p className="text-slate-500 text-sm mt-1">{customer.name}{customer.business_name ? ` · ${customer.business_name}` : ''}</p>
        </div>
        <StatementExportButton statement={statement} customerName={customer.name} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Invoiced</p>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{formatINR(statement.total_invoiced)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">₹{formatINR(statement.total_paid)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${statement.closing_balance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Balance Due</p>
          <p className={`text-xl font-bold mt-1 ${statement.closing_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ₹{formatINR(Math.abs(statement.closing_balance))}
            {statement.closing_balance < 0 && <span className="text-sm font-normal ml-1">(credit)</span>}
          </p>
        </div>
      </div>

      {/* Ledger table */}
      {statement.transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500">No transactions found for this customer.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Transaction Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">{statement.transactions.length} transactions · Opening balance: ₹0.00</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Reference</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Description</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-red-400 uppercase tracking-wide">Debit</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide">Credit</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.transactions.map((tx, i) => (
                  <tr key={i} className={`hover:bg-slate-50 ${tx.type === 'payment' ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.date_display}</td>
                    <td className="px-5 py-3">
                      {tx.type === 'invoice' ? (
                        <Link href={`/invoices?search=${tx.reference}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                          {tx.reference}
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Payment
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs truncate">{tx.description}</td>
                    <td className="px-5 py-3 text-right text-sm">
                      {tx.debit > 0 ? (
                        <span className="font-semibold text-red-600">₹{formatINR(tx.debit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm">
                      {tx.credit > 0 ? (
                        <span className="font-semibold text-emerald-600">₹{formatINR(tx.credit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-sm font-bold ${tx.balance > 0 ? 'text-red-600' : tx.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        ₹{formatINR(Math.abs(tx.balance))}
                        {tx.balance < 0 && ' Cr'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3 font-semibold text-slate-700 text-sm">Closing Balance</td>
                  <td className="px-5 py-3 text-right font-semibold text-red-600 text-sm">
                    ₹{formatINR(statement.total_invoiced)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 text-sm">
                    ₹{formatINR(statement.total_paid)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-base font-bold ${statement.closing_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹{formatINR(Math.abs(statement.closing_balance))}
                      {statement.closing_balance < 0 && ' Cr'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/customers/StatementExportButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { DownloadIcon } from 'lucide-react'
import type { CustomerStatement } from '@/actions/customers'

interface Props {
  statement: CustomerStatement
  customerName: string
}

export function StatementExportButton({ statement, customerName }: Props) {
  const [exporting, setExporting] = useState(false)

  function handleExport() {
    setExporting(true)
    try {
      const rows = [
        ['Date', 'Reference', 'Description', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'],
        ...statement.transactions.map(tx => [
          tx.date_display,
          tx.reference,
          tx.description,
          tx.debit > 0 ? tx.debit : '',
          tx.credit > 0 ? tx.credit : '',
          tx.balance,
        ]),
        [],
        ['', '', 'TOTAL', statement.total_invoiced, statement.total_paid, statement.closing_balance],
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Statement')
      XLSX.writeFile(wb, `Statement_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || statement.transactions.length === 0}
      className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
    >
      <DownloadIcon className="size-4" />
      Export Excel
    </button>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/customers/[id]/statement/" components/customers/StatementExportButton.tsx
git commit -m "feat(statement): customer account statement page + Excel export"
```

---

### Task 3: Link from customer detail page

**Files:**
- Modify: `app/(dashboard)/customers/[id]/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/customers/[id]/page.tsx`** to find the header buttons area (near Edit button).

- [ ] **Step 2: Add Statement link button**

Find where the Edit button is rendered:
```tsx
<Link href={`/customers/${customer.id}/edit`}>
  <Button size="sm">Edit</Button>
</Link>
```

Add before it:
```tsx
<Link href={`/customers/${customer.id}/statement`}>
  <Button variant="outline" size="sm">Statement</Button>
</Link>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/customers/[id]/page.tsx"
git commit -m "feat(statement): Statement link button on customer detail"
```

---

### Verification Checklist

- [ ] Open any customer with invoices → "Statement" button visible in header
- [ ] Statement page loads with correct customer name
- [ ] Ledger shows invoices as debits (red) and payments as credits (green)
- [ ] Running balance is correct — invoice adds, payment subtracts
- [ ] Summary cards show correct totals (Total Invoiced, Total Paid, Balance Due)
- [ ] Balance Due is red if positive, green if credit
- [ ] Export Excel button downloads `.xlsx` file
- [ ] Excel file has all transactions with correct amounts
- [ ] Customer with no invoices shows empty state
- [ ] Cancelled invoices NOT included in statement
