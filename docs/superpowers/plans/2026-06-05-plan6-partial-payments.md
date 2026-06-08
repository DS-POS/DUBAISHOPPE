# Partial Payments + Customer Invoice View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow partial payments at checkout for ALL payment methods with tendered/reference fields, and enhance the customer detail page to show per-invoice payment breakdown with totals.

**Architecture:** Two focused changes — (1) CheckoutForm gains `amountTendered` + optional reference for every payment method including new `bank_transfer` option, and (2) customer detail page shows `amount_paid`, balance due, and outstanding totals across all customer invoices.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgreSQL, Tailwind CSS, shadcn/ui

---

## Context — what already exists (DO NOT rebuild)

- `actions/invoice-payments.ts` — `addInvoicePayment`, `deleteInvoicePayment`, `getInvoicePayments`, `recomputeInvoicePaymentStatus` all fully implemented
- `components/invoices/RecordPaymentDialog.tsx` — full payment history table + record form, wired to invoice detail page
- `supabase/migrations/006_invoice_payments.sql` — `invoice_payments` table exists in DB
- `app/(dashboard)/invoices/[id]/page.tsx` — already renders `RecordPaymentDialog` with full payment history

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `components/billing/CheckoutForm.tsx` | Modify | Add bank_transfer button; show tendered+reference fields for ALL methods; fix amountPaid logic |
| `actions/invoices.ts` | Modify | Add `bank_transfer` to `CreateInvoiceData.payment_method` union type |
| `actions/customers.ts` | Modify | `getCustomerInvoices` selects `amount_paid` field |
| `app/(dashboard)/customers/[id]/page.tsx` | Modify | Add Paid / Balance columns to invoice table + totals row |

---

## Task 1: CheckoutForm — tendered field + reference for all payment methods + bank_transfer

**Files:**
- Modify: `components/billing/CheckoutForm.tsx`
- Modify: `actions/invoices.ts`

### What the current code does (read before editing)

In `CheckoutForm.tsx`:
- Local type: `type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit'` — **missing `bank_transfer`**
- Payment buttons: 4 buttons in `grid-cols-4` (Cash, UPI, Card, Credit)
- `amountTendered` state exists but is only shown when `paymentMethod === 'cash'`
- `amountPaid` logic (line ~141): `paymentMethod === 'cash' && amountTendered ? parseFloat(amountTendered) : totals.grand_total` — **only works for cash**

In `actions/invoices.ts`:
- `CreateInvoiceData.payment_method` type: `'cash' | 'upi' | 'card' | 'credit'` — **missing `bank_transfer`**

### Steps

- [ ] **Step 1: Add `bank_transfer` to `CreateInvoiceData` in `actions/invoices.ts`**

Find the `CreateInvoiceData` interface (around line 30–50) and update `payment_method`:

```typescript
// In actions/invoices.ts — CreateInvoiceData interface
payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit'
```

- [ ] **Step 2: Update `CheckoutForm.tsx` — payment method type + buttons**

Replace the local `PaymentMethod` type and the payment buttons array:

```typescript
// Replace old type
type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit'
```

Replace the payment buttons JSX. The old grid is `grid-cols-4`. Change to `grid-cols-5` with bank_transfer added. Import `BuildingIcon` from lucide-react for bank transfer.

```tsx
// Add to imports at top of file
import { SearchIcon, BanknoteIcon, SmartphoneIcon, CreditCardIcon, WalletIcon, BuildingIcon } from 'lucide-react'
```

Replace payment buttons array:
```tsx
{([
  { value: 'cash' as const, label: 'Cash', icon: <BanknoteIcon className="size-5" /> },
  { value: 'upi' as const, label: 'UPI', icon: <SmartphoneIcon className="size-5" /> },
  { value: 'card' as const, label: 'Card', icon: <CreditCardIcon className="size-5" /> },
  { value: 'bank_transfer' as const, label: 'Bank', icon: <BuildingIcon className="size-5" /> },
  { value: 'credit' as const, label: 'Credit', icon: <WalletIcon className="size-5" /> },
]).map(m => (
  <button
    key={m.value}
    type="button"
    onClick={() => setPaymentMethod(m.value)}
    className={[
      'flex flex-col items-center gap-2 py-3 rounded-lg border text-xs font-medium transition-colors',
      paymentMethod === m.value
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-background text-muted-foreground hover:bg-accent',
    ].join(' ')}
  >
    {m.icon}
    {m.label}
  </button>
))}
```

Change outer div class from `grid-cols-4` to `grid-cols-5`.

- [ ] **Step 3: Add `paymentReference` state + show tendered+reference for ALL non-credit methods**

Add state at top of component (near existing `amountTendered` state):
```typescript
const [paymentReference, setPaymentReference] = useState('')
```

Replace the entire payment section (currently: the credit warning block + the cash-only tendered block) with this unified block that shows for all non-credit methods:

```tsx
{paymentMethod === 'credit' && creditAvailable !== undefined && totals.grand_total > creditAvailable && (
  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
    <span className="text-amber-500 mt-0.5">⚠️</span>
    <div>
      <p className="font-semibold">Credit limit exceeded</p>
      <p>Order ₹{totals.grand_total.toFixed(2)} exceeds available credit of ₹{creditAvailable.toFixed(2)}.</p>
    </div>
  </div>
)}

{paymentMethod !== 'credit' && (
  <div className="space-y-3">
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">
        Amount Tendered <span className="text-muted-foreground font-normal">(leave blank to mark fully paid)</span>
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <input
          type="number"
          value={amountTendered}
          min={0}
          step={0.01}
          onChange={e => setAmountTendered(e.target.value)}
          placeholder={totals.grand_total.toFixed(2)}
          className="w-full pl-7 pr-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {tendered > 0 && tendered >= totals.grand_total && (
        <p className="text-sm font-medium text-emerald-600">
          {paymentMethod === 'cash' ? `Change: ₹${(tendered - totals.grand_total).toFixed(2)}` : 'Fully paid'}
        </p>
      )}
      {tendered > 0 && tendered < totals.grand_total && (
        <p className="text-sm font-medium text-amber-600">
          Balance Due: ₹{(totals.grand_total - tendered).toFixed(2)} — invoice will be marked pending
        </p>
      )}
    </div>
    {paymentMethod !== 'cash' && (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          {paymentMethod === 'upi' ? 'UPI Reference / UTR' :
           paymentMethod === 'card' ? 'Approval Code' :
           'Transfer Reference'} <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={paymentReference}
          onChange={e => setPaymentReference(e.target.value)}
          placeholder={
            paymentMethod === 'upi' ? 'e.g. 123456789012' :
            paymentMethod === 'card' ? 'e.g. 123456' :
            'e.g. NEFT/RTGS ref'
          }
          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Fix `amountPaid` logic in `handleSubmit` to work for all methods**

Replace the old `amountPaid` calculation (around line 141):

```typescript
// OLD — only handled cash
const amountPaid = paymentMethod === 'cash' && amountTendered
  ? parseFloat(amountTendered) || totals.grand_total
  : totals.grand_total

// NEW — works for all methods: if tendered entered, use it (capped at grand_total); else fully paid
const tenderedAmt = parseFloat(amountTendered) || 0
const amountPaid = tenderedAmt > 0
  ? Math.min(tenderedAmt, totals.grand_total)
  : totals.grand_total
```

- [ ] **Step 5: Verify TypeScript — run typecheck**

```powershell
cd "c:\Users\PC\Desktop\DS POS" ; npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Expected: 0 errors related to the changed files.

- [ ] **Step 6: Commit**

```powershell
git add components/billing/CheckoutForm.tsx actions/invoices.ts
git commit -m "feat(billing): amount tendered + reference for all payment methods + bank_transfer option"
```

---

## Task 2: Customer detail — invoice payment breakdown + totals

**Files:**
- Modify: `actions/customers.ts`
- Modify: `app/(dashboard)/customers/[id]/page.tsx`

### What the current code does (read before editing)

In `actions/customers.ts`:
- `getCustomerInvoices(customerId)` selects: `id, invoice_no, grand_total, status, payment_method, created_at` — **missing `amount_paid`**

In `app/(dashboard)/customers/[id]/page.tsx`:
- Invoice table columns: Invoice #, Date, Amount, Status, Method — **missing Paid, Balance**
- No totals row at the bottom

### Steps

- [ ] **Step 1: Add `amount_paid` to `getCustomerInvoices` query in `actions/customers.ts`**

Find `getCustomerInvoices` function (it selects `id, invoice_no, grand_total, status, payment_method, created_at`). Add `amount_paid` to the select:

```typescript
export async function getCustomerInvoices(customerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, grand_total, amount_paid, status, payment_method, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 2: Update customer detail page — add Paid + Balance columns + totals row**

In `app/(dashboard)/customers/[id]/page.tsx`, find the invoice history table section.

Replace the `<table>` section's thead and tbody with this enhanced version that adds Paid and Balance Due columns, plus a totals row:

```tsx
{/* Invoice History */}
<div className="rounded-xl border border-border overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-muted/50 border-b border-border">
      <tr>
        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Invoice</th>
        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Date</th>
        <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Total</th>
        <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Paid</th>
        <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Balance</th>
        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Status</th>
        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Method</th>
      </tr>
    </thead>
    <tbody>
      {invoices.map((inv, i) => {
        const balance = Math.max(0, inv.grand_total - (inv.amount_paid ?? 0))
        return (
          <tr key={inv.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
            <td className="px-3 py-2">
              <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline font-medium text-xs">
                {inv.invoice_no}
              </Link>
            </td>
            <td className="px-3 py-2 text-xs text-muted-foreground">
              {format(new Date(inv.created_at), 'dd MMM yyyy')}
            </td>
            <td className="px-3 py-2 text-right text-xs font-semibold">
              ₹{inv.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td className="px-3 py-2 text-right text-xs text-emerald-600 font-medium">
              ₹{(inv.amount_paid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td className={`px-3 py-2 text-right text-xs font-semibold ${balance > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {balance > 0 ? `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            </td>
            <td className="px-3 py-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[inv.status as keyof typeof STATUS_STYLE] ?? 'bg-slate-100 text-slate-600'}`}>
                {inv.status === 'pending' ? 'Due' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </span>
            </td>
            <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{inv.payment_method ?? '—'}</td>
          </tr>
        )
      })}
    </tbody>
    {invoices.length > 0 && (() => {
      const totalInvoiced = invoices.reduce((s, i) => s + i.grand_total, 0)
      const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0)
      const totalOutstanding = Math.max(0, totalInvoiced - totalPaid)
      return (
        <tfoot className="border-t-2 border-border bg-muted/30">
          <tr>
            <td className="px-3 py-2 text-xs font-bold text-muted-foreground" colSpan={2}>
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </td>
            <td className="px-3 py-2 text-right text-xs font-bold">
              ₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600">
              ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td className={`px-3 py-2 text-right text-xs font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {totalOutstanding > 0 ? `₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      )
    })()}
  </table>
</div>
```

**Important:** The customer detail page uses `format` from `date-fns` (already imported), `Link` from `next/link` (already imported), and `STATUS_STYLE` const (already defined in the file). Do NOT add duplicate imports.

- [ ] **Step 3: Verify TypeScript + lint**

```powershell
cd "c:\Users\PC\Desktop\DS POS" ; npx tsc --noEmit 2>&1 | Select-Object -First 30
```

```powershell
cd "c:\Users\PC\Desktop\DS POS" ; npx next lint 2>&1 | Select-Object -First 30
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```powershell
git add actions/customers.ts "app/(dashboard)/customers/[id]/page.tsx"
git commit -m "feat(customers): invoice breakdown — paid/balance columns + outstanding totals row"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Amount tendered for ALL payment methods (cash, UPI, card, bank_transfer) — Task 1
- [x] Reference field for UPI/card/bank_transfer — Task 1 Step 3
- [x] bank_transfer payment method added — Task 1 Step 2
- [x] Partial amount → invoice stays pending, balance shown — Task 1 Step 3+4
- [x] Customer invoices grouped under customer — already exists; Task 2 adds detail
- [x] Per-invoice: paid amount + balance — Task 2
- [x] Totals row: total invoiced, total paid, total outstanding — Task 2

**Type consistency:**
- `PaymentMethod` in CheckoutForm updated to include `bank_transfer` ✓
- `CreateInvoiceData.payment_method` updated to include `bank_transfer` ✓
- `getCustomerInvoices` return type gains `amount_paid: number` ✓
- Customer detail page uses `inv.amount_paid ?? 0` safely ✓
