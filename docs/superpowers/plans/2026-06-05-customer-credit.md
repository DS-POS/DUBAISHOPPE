# Customer Credit & Balance Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credit limit and outstanding balance tracking to customers — show how much a customer owes, enforce a credit limit during billing, and display balance in customer detail page.

**Architecture:** Add `credit_limit` column to `customers` table. Outstanding balance is computed live from unpaid/pending invoice totals. The billing checkout flow checks credit before saving. Customer detail page shows credit used vs limit.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `types/database.ts` | Modify | Add `credit_limit` to `Customer` interface |
| `actions/customers.ts` | Modify | Add `getCustomerCreditSummary` action |
| `actions/invoices.ts` | Modify | Check credit limit in `createInvoice` |
| `components/settings/CustomerForm.tsx` (or product form equiv) | Modify | Add credit limit field to customer create/edit |
| `app/(dashboard)/customers/[id]/page.tsx` | Modify | Show credit used / credit limit card |
| `components/billing/CheckoutForm.tsx` or `BillingForm.tsx` | Modify | Block checkout if over credit limit |

---

### Task 1: DB migration — `credit_limit` on customers

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Apply Supabase migration**

Use Supabase MCP `apply_migration`:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0 NOT NULL;
```

- [ ] **Step 2: Update `Customer` interface in `types/database.ts`**

In the `Customer` interface, add after `state: string`:
```typescript
credit_limit: number
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors (credit_limit optional in form data so existing callers unaffected).

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat(customers): add credit_limit column + type"
```

---

### Task 2: `getCustomerCreditSummary` server action

**Files:**
- Modify: `actions/customers.ts`

- [ ] **Step 1: Read `actions/customers.ts`** to understand existing exports and imports.

- [ ] **Step 2: Add `getCustomerCreditSummary` to `actions/customers.ts`**

At the end of the file, add:

```typescript
export interface CustomerCreditSummary {
  customer_id: string
  credit_limit: number
  outstanding: number
  available_credit: number
}

export async function getCustomerCreditSummary(customerId: string): Promise<CustomerCreditSummary> {
  const supabase = await createClient()

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, credit_limit')
    .eq('id', customerId)
    .single()
  if (cErr || !customer) throw new Error('Customer not found')

  // Sum all unpaid (pending) invoice grand_totals minus amount_paid
  const { data: invoices, error: iErr } = await supabase
    .from('invoices')
    .select('grand_total, amount_paid')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
  if (iErr) throw new Error(iErr.message)

  const outstanding = (invoices ?? []).reduce(
    (sum, inv) => sum + (inv.grand_total - inv.amount_paid),
    0
  )

  return {
    customer_id: customerId,
    credit_limit: customer.credit_limit,
    outstanding: Math.max(0, outstanding),
    available_credit: Math.max(0, customer.credit_limit - outstanding),
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add actions/customers.ts
git commit -m "feat(customers): getCustomerCreditSummary action"
```

---

### Task 3: Add credit limit field to customer create/edit forms

**Files:**
- Modify: the customer create/edit form component (find by reading `app/(dashboard)/customers/new/page.tsx` to discover which component is used)

- [ ] **Step 1: Read `app/(dashboard)/customers/new/page.tsx`** to find the form component path.

- [ ] **Step 2: Read the customer form component**

Look for `credit_limit` field. If missing, add it.

- [ ] **Step 3: Add credit limit field**

In the form's JSX (after the `state` select field), add:

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-semibold text-slate-700">Credit Limit (₹)</label>
  <input
    type="number"
    min={0}
    step={100}
    value={formData.credit_limit ?? 0}
    onChange={e => setFormData(prev => ({ ...prev, credit_limit: parseFloat(e.target.value) || 0 }))}
    placeholder="0 = no credit"
    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
  />
  <p className="text-xs text-slate-400">Set 0 for cash-only customers. Billing will warn when limit is exceeded.</p>
</div>
```

- [ ] **Step 4: Ensure `credit_limit` is passed in create/update action calls**

Find where `createCustomer` or `updateCustomer` is called and ensure `credit_limit: formData.credit_limit ?? 0` is included.

Also verify `actions/customers.ts` `createCustomer` and `updateCustomer` pass `credit_limit` to Supabase insert/update.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/ actions/customers.ts
git commit -m "feat(customers): credit_limit field in create/edit form"
```

---

### Task 4: Customer detail page — credit summary card

**Files:**
- Modify: `app/(dashboard)/customers/[id]/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/customers/[id]/page.tsx`** to understand current structure.

- [ ] **Step 2: Import and call `getCustomerCreditSummary`**

At the top of the server component, alongside existing data fetches:

```typescript
import { getCustomerCreditSummary } from '@/actions/customers'

// inside the async function, after fetching customer:
const creditSummary = customer.credit_limit > 0
  ? await getCustomerCreditSummary(customer.id)
  : null
```

- [ ] **Step 3: Add credit summary card to JSX**

After the customer info card, add:

```tsx
{creditSummary && (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Credit Account</h3>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-xs text-slate-500">Credit Limit</p>
        <p className="text-lg font-bold text-slate-900">₹{creditSummary.credit_limit.toLocaleString('en-IN')}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Outstanding</p>
        <p className={`text-lg font-bold ${creditSummary.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          ₹{creditSummary.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Available</p>
        <p className={`text-lg font-bold ${creditSummary.available_credit <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          ₹{creditSummary.available_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
    {/* Progress bar */}
    <div className="mt-3">
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            creditSummary.outstanding >= creditSummary.credit_limit ? 'bg-red-500' :
            creditSummary.outstanding > creditSummary.credit_limit * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, (creditSummary.outstanding / creditSummary.credit_limit) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">
        {((creditSummary.outstanding / creditSummary.credit_limit) * 100).toFixed(0)}% of credit limit used
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/customers/
git commit -m "feat(customers): credit summary card on customer detail"
```

---

### Task 5: Credit check in billing checkout

**Files:**
- Modify: `components/billing/CheckoutForm.tsx` (read it first to understand current structure)

- [ ] **Step 1: Read `components/billing/CheckoutForm.tsx`**

- [ ] **Step 2: Pass customer credit info from BillingForm**

In `components/billing/BillingForm.tsx`, before opening checkout, if customer has `credit_limit > 0` and payment method is `credit`, fetch summary via `getCustomerCreditSummary`. Pass `availableCredit` and `creditLimit` as props to `CheckoutForm`.

Since `getCustomerCreditSummary` is a server action, call it in `handleCheckout` before opening modal:

In `BillingForm.tsx`, find/add `handleCheckout` or similar opening logic. Add:

```typescript
import { getCustomerCreditSummary } from '@/actions/customers'

// before opening checkout:
let creditInfo: { limit: number; available: number } | null = null
if (customer && customer.credit_limit > 0) {
  try {
    const summary = await getCustomerCreditSummary(customer.id)
    creditInfo = { limit: summary.credit_limit, available: summary.available_credit }
  } catch { /* ignore */ }
}
```

- [ ] **Step 3: Add credit warning in `CheckoutForm`**

In `CheckoutForm.tsx`, if payment method is `'credit'` and `creditInfo` is provided, show warning if `grandTotal > creditInfo.available`:

```tsx
{paymentMethod === 'credit' && creditInfo && grandTotal > creditInfo.available && (
  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
    ⚠️ This order (₹{grandTotal.toFixed(2)}) exceeds available credit of ₹{creditInfo.available.toFixed(2)}.
    <br />Consider a different payment method or reduce order amount.
  </div>
)}
```

Note: This is a **warning**, not a hard block — business decision to warn but allow. If user wants hard block, it's easy to disable the confirm button instead.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/billing/
git commit -m "feat(billing): credit limit warning on credit payment checkout"
```

---

### Verification Checklist

- [ ] Create customer with credit limit ₹10,000
- [ ] Customer detail shows Credit Account card (limit, outstanding, available)
- [ ] Create unpaid invoice for that customer — outstanding balance increases
- [ ] In billing, select that customer, go to checkout, pick "Credit" payment — see available credit
- [ ] Try checkout with amount > available credit — warning shows
- [ ] Set credit_limit=0 → no credit card shown
