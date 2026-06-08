# Customer Receivables (AR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customer AR aging report (who owes how much, for how long), credit limit enforcement in billing, WhatsApp payment reminder link, and enhanced customer ledger.

**Architecture:** Add `credit_limit` + `credit_days` to customers table (already in types but missing from DB). New `getReceivablesAging` action computes outstanding per customer bucketed by age. Billing warns/blocks when customer exceeds credit limit. Customer statement page gets PDF print button.

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, xlsx (existing)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/011_customer_credit.sql` | CREATE — add credit_limit + credit_days to customers |
| `types/database.ts` | Modify — add credit_days to Customer |
| `actions/customers.ts` | Modify — add getReceivablesAging, getCustomerCreditStatus |
| `components/billing/CustomerSelector.tsx` | Modify — show credit warning when limit exceeded |
| `components/billing/BillingForm.tsx` | Modify — block checkout if credit limit breached |
| `app/(dashboard)/reports/receivables/page.tsx` | CREATE — AR aging report |
| `app/(dashboard)/customers/[id]/statement/page.tsx` | Modify — add Print + WhatsApp reminder button |
| `app/(dashboard)/customers/[id]/edit/page.tsx` | Modify — add credit_limit + credit_days fields |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/011_customer_credit.sql`

- [ ] **Step 1: Write migration**

```sql
-- 011_customer_credit.sql

-- Add missing columns to customers table
-- credit_limit: 0 = no limit, >0 = max outstanding allowed
alter table public.customers
  add column if not exists credit_limit numeric(12,2) not null default 0,
  add column if not exists credit_days integer not null default 30,
  add column if not exists business_name text;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration`. Project ref: `lzvyzfwbsssvofrjbndx`.

- [ ] **Step 3: Verify**

```sql
select column_name from information_schema.columns
where table_name = 'customers'
  and column_name in ('credit_limit','credit_days','business_name');
-- expect 3 rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_customer_credit.sql
git commit -m "feat(ar): add credit_limit + credit_days + business_name to customers"
```

---

### Task 2: Types update

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add credit_days to Customer interface**

`credit_limit` already exists in the type. Add `credit_days`:
```typescript
credit_days: number
```

- [ ] **Step 2: Commit**

```bash
git add types/database.ts
git commit -m "feat(ar): add credit_days to Customer type"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `actions/customers.ts`

- [ ] **Step 1: Add getReceivablesAging to actions/customers.ts**

Append:
```typescript
export interface ReceivableAging {
  customer_id: string
  customer_name: string
  phone: string | null
  current: number     // 0 to credit_days
  days_31_60: number
  days_61_90: number
  over_90: number
  total_due: number
}

export async function getReceivablesAging(): Promise<ReceivableAging[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id, created_at, grand_total,
      customer_id,
      customers(id, name, phone, credit_days),
      invoice_payments(amount)
    `)
    .eq('status', 'pending')
    .not('customer_id', 'is', null)

  const today = new Date()
  const byCustomer: Record<string, ReceivableAging> = {}

  for (const inv of (invoices ?? [])) {
    const cust = inv.customers as { id: string; name: string; phone: string | null; credit_days: number } | null
    if (!cust) continue

    const paid = ((inv.invoice_payments ?? []) as { amount: number }[])
      .reduce((s, p) => s + Number(p.amount), 0)
    const outstanding = Number(inv.grand_total) - paid
    if (outstanding <= 0) continue

    const key = cust.id
    if (!byCustomer[key]) {
      byCustomer[key] = { customer_id: cust.id, customer_name: cust.name, phone: cust.phone, current: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total_due: 0 }
    }

    const invDate = new Date(inv.created_at)
    const ageDays = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24))
    const creditDays = cust.credit_days ?? 30

    const entry = byCustomer[key]
    if (ageDays <= creditDays) entry.current += outstanding
    else if (ageDays <= creditDays + 30) entry.days_31_60 += outstanding
    else if (ageDays <= creditDays + 60) entry.days_61_90 += outstanding
    else entry.over_90 += outstanding
    entry.total_due += outstanding
  }

  return Object.values(byCustomer).filter(c => c.total_due > 0).sort((a, b) => b.total_due - a.total_due)
}
```

- [ ] **Step 2: Add getCustomerCreditStatus**

Append:
```typescript
export interface CustomerCreditStatus {
  outstanding: number
  credit_limit: number
  over_limit: boolean
  available_credit: number
}

export async function getCustomerCreditStatus(customerId: string): Promise<CustomerCreditStatus> {
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('credit_limit')
    .eq('id', customerId)
    .single()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('grand_total, invoice_payments(amount)')
    .eq('customer_id', customerId)
    .eq('status', 'pending')

  const outstanding = (invoices ?? []).reduce((sum, inv) => {
    const paid = ((inv.invoice_payments ?? []) as { amount: number }[])
      .reduce((s, p) => s + Number(p.amount), 0)
    return sum + (Number(inv.grand_total) - paid)
  }, 0)

  const credit_limit = Number(customer?.credit_limit ?? 0)
  const over_limit = credit_limit > 0 && outstanding >= credit_limit
  const available_credit = credit_limit > 0 ? Math.max(0, credit_limit - outstanding) : Infinity

  return { outstanding, credit_limit, over_limit, available_credit }
}
```

- [ ] **Step 3: Commit**

```bash
git add actions/customers.ts
git commit -m "feat(ar): getReceivablesAging + getCustomerCreditStatus actions"
```

---

### Task 4: Credit limit warning in billing

**Files:**
- Modify: `components/billing/CustomerSelector.tsx`

- [ ] **Step 1: Add credit warning display to CustomerSelector**

After the existing customer display section, add a credit warning when customer has a credit limit and outstanding balance:

In `CustomerSelector.tsx`, after the selected customer name is shown, add:
```tsx
{selected && selected.credit_limit > 0 && (
  <CreditWarning customerId={selected.id} creditLimit={selected.credit_limit} />
)}
```

Create a small async component or pass the credit status as a prop. Since CustomerSelector is a client component, fetch credit status via a server action call in the parent (`BillingForm`) and pass down as prop.

- [ ] **Step 2: In BillingForm, fetch credit status when customer changes**

In `BillingForm.tsx`, add state:
```typescript
const [creditStatus, setCreditStatus] = useState<{ outstanding: number; credit_limit: number; over_limit: boolean } | null>(null)
```

Update `handleCustomerChange`:
```typescript
const handleCustomerChange = useCallback(async (c: Customer | null) => {
  setCustomer(c)
  const state = c?.state ?? 'Telangana'
  setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
  if (c && c.credit_limit > 0) {
    const status = await getCustomerCreditStatus(c.id)
    setCreditStatus(status)
  } else {
    setCreditStatus(null)
  }
}, [])
```

- [ ] **Step 3: Show credit warning in BillingForm sidebar**

After `<CustomerSelector>` component in the sidebar, add:
```tsx
{creditStatus && creditStatus.credit_limit > 0 && (
  <div className={`rounded-xl p-3 text-sm ${creditStatus.over_limit ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
    <p className={`font-semibold ${creditStatus.over_limit ? 'text-red-700' : 'text-amber-700'}`}>
      {creditStatus.over_limit ? '⚠ Credit limit exceeded' : 'Credit info'}
    </p>
    <p className="text-xs mt-0.5 text-slate-600">
      Outstanding: ₹{creditStatus.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} /
      Limit: ₹{creditStatus.credit_limit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
    </p>
  </div>
)}
```

- [ ] **Step 4: Block checkout when credit limit exceeded**

In `handleCheckout()` in BillingForm, add before existing checks:
```typescript
if (creditStatus?.over_limit && customer?.credit_limit && customer.credit_limit > 0) {
  toast.error(`Credit limit exceeded. Outstanding: ₹${creditStatus.outstanding.toLocaleString('en-IN')}. Limit: ₹${customer.credit_limit.toLocaleString('en-IN')}`)
  return
}
```

- [ ] **Step 5: Commit**

```bash
git add components/billing/
git commit -m "feat(ar): credit limit warning + checkout block in billing"
```

---

### Task 5: AR aging report page

**Files:**
- Create: `app/(dashboard)/reports/receivables/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/reports/receivables/page.tsx**

```tsx
import { getReceivablesAging } from '@/actions/customers'
import Link from 'next/link'

const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default async function ReceivablesPage() {
  const aging = await getReceivablesAging()
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
        <h1 className="text-2xl font-bold text-slate-900">Accounts Receivable</h1>
        <p className="text-sm text-slate-500 mt-0.5">Customer outstanding balances by age</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Within Credit Days', value: totals.current, color: 'text-emerald-600' },
          { label: '31–60 Days Overdue', value: totals.days_31_60, color: 'text-amber-600' },
          { label: '61–90 Days Overdue', value: totals.days_61_90, color: 'text-orange-600' },
          { label: '90+ Days Overdue', value: totals.over_90, color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {aging.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <p className="font-semibold text-slate-600">No outstanding receivables</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Within Terms</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">31–60 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">61–90 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">90+ Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total Due</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aging.map(row => (
                <tr key={row.customer_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.customer_name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(row.current)}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-medium">{fmt(row.days_31_60)}</td>
                  <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(row.days_61_90)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(row.over_90)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(row.total_due)}</td>
                  <td className="px-4 py-3 flex gap-2 justify-end">
                    <Link href={`/customers/${row.customer_id}/statement`} className="text-xs text-[#111827] font-medium hover:underline">
                      Statement →
                    </Link>
                    {row.phone && (
                      <a
                        href={`https://wa.me/91${row.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Dear ${row.customer_name}, you have an outstanding balance of ₹${row.total_due.toLocaleString('en-IN')}. Please contact us at your earliest convenience. - Dubai Shoppe`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 font-medium hover:underline"
                      >
                        WhatsApp
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-3 text-slate-900" colSpan={2}>Total</td>
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

- [ ] **Step 2: Add link to reports page**

In `app/(dashboard)/reports/page.tsx`, add a card linking to `/reports/receivables`.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/reports/receivables/ app/(dashboard)/reports/page.tsx
git commit -m "feat(ar): /reports/receivables AR aging + WhatsApp reminder links"
```

---

### Task 6: Customer edit form — credit_limit + credit_days

**Files:**
- Modify: `app/(dashboard)/customers/[id]/edit/page.tsx` (or CustomerForm component)

- [ ] **Step 1: Add credit_limit and credit_days fields to customer form**

Find the customer edit form (check if `components/customers/CustomerForm.tsx` exists first, otherwise edit the page directly).

Add two fields after the state/address section:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-slate-700">Credit Limit (₹)</label>
    <input
      type="number"
      {...register('credit_limit', { valueAsNumber: true })}
      min={0}
      placeholder="0 = no limit"
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
    />
    <p className="text-xs text-slate-400">Enter 0 to disable credit limit check</p>
  </div>
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-slate-700">Credit Days</label>
    <input
      type="number"
      {...register('credit_days', { valueAsNumber: true })}
      min={0}
      placeholder="30"
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
    />
    <p className="text-xs text-slate-400">Payment due within N days</p>
  </div>
</div>
```

- [ ] **Step 2: Add credit_limit and credit_days to Zod schema**

```typescript
credit_limit: z.number().min(0).default(0),
credit_days: z.number().min(0).default(30),
```

- [ ] **Step 3: Include in update action**

In `actions/customers.ts` updateCustomer, include `credit_limit` and `credit_days` in the update payload.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/customers/ actions/customers.ts
git commit -m "feat(ar): credit_limit + credit_days on customer edit form"
```

---

### Task 7: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Test**

1. Edit a customer → set credit_limit=10000, credit_days=30 → save
2. Go to Billing → select that customer → add items totaling >₹10,000 → verify red warning appears
3. Try checkout → verify blocked with error message
4. Go to Reports → Receivables → verify aging table shows pending invoices
5. WhatsApp link in table opens correct wa.me URL

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ar): complete AR module — aging report + credit enforcement + WhatsApp reminders"
```
