# DS POS — All 21 Annotation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 21 pending Agentation UI annotations across 10 pages of DS POS — collapsable lists, modern UI, print A4, inventory search, inline add brand/category, dashboard widgets.

**Architecture:** Purely UI/UX and feature fixes in existing files. No new routes. Each task is 1–3 files. Server components stay server; only client wrappers added where interactivity is needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, React hooks, lucide-react

---

## File Map

| File | Task |
|------|------|
| `components/invoices/InvoiceList.tsx` | T1 — add accordion expand/collapse |
| `app/(dashboard)/invoices/[id]/page.tsx` | T2 — modern UI redesign |
| `components/invoice/PrintReceiptButton.tsx` | T3 — rename + A4 print |
| `app/(dashboard)/returns/page.tsx` | T4 — delete button |
| `actions/sales-returns.ts` | T4 — verify inventory restore |
| `components/billing/CheckoutForm.tsx` | T5 — grand total color + font sizes |
| `app/(dashboard)/billing/checkout/page.tsx` | T5 — light background |
| `components/products/ProductsTable.tsx` | T6 — rounded search bar |
| `components/products/ProductForm.tsx` | T7 — Add Brand inline |
| `components/stock-in/SupplierInvoiceList.tsx` | T8 — modern UI + supplier accordion |
| `app/(dashboard)/stock-in/page.tsx` | T8 — simplify header |
| `components/stock-in/ProductCombobox.tsx` | T9 — show all on focus |
| `app/(dashboard)/stock-adjustments/page.tsx` | T10 — add actions column |
| `components/stock-adjustments/StockAdjustmentForm.tsx` | T10 — dropdown arrow + show all on focus |
| `actions/stock-adjustments.ts` | T10 — delete action |
| `components/stock-adjustments/StockAdjustmentsListClient.tsx` (NEW) | T10 — client delete row |
| `components/purchase-orders/POForm.tsx` | T11 — card style |
| `components/expenses/ExpenseForm.tsx` | T12 — Add Category inline |
| `actions/expenses.ts` | T12 — createExpenseCategory |
| `components/store-loans/StoreLoanForm.tsx` | T13 — inventory combobox |
| `actions/store-loans.ts` | T13 — stock deduction on loan |
| `app/(dashboard)/store-loans/new/page.tsx` | T13 — pass products prop |
| `components/customers/CustomerList.tsx` | T14 — accordion cards |
| `components/dashboard/LowStockWidget.tsx` | T15 — lighter + collapsable |
| `components/dashboard/LowStockWidgetClient.tsx` (NEW) | T15 — client collapse wrapper |
| `components/dashboard/useDashboardWidgets.ts` | T16 — 3 new widget IDs |
| `components/dashboard/DashboardWidgets.tsx` | T16 — 3 new props |
| `app/(dashboard)/dashboard/page.tsx` | T16 — pass 3 new widgets |
| `components/dashboard/LabelsQuickWidget.tsx` (NEW) | T16 — labels widget |
| `components/dashboard/CustomersQuickWidget.tsx` (NEW) | T16 — customers widget |
| `components/dashboard/SuppliersQuickWidget.tsx` (NEW) | T16 — suppliers widget |

---

## Task 1: InvoiceList — Collapsable Customer Accordion

**Annotations:** mq2356su-f4owlu, mq24cgwx-mg502p

**File:** `components/invoices/InvoiceList.tsx`

Current state: groups render ALL invoices flat beneath group header — no toggle. User wants accordion like quotations tab.

- [ ] **Step 1: Add expanded state**

In `components/invoices/InvoiceList.tsx`, after the existing state declarations (around line 55), add:

```tsx
const [expanded, setExpanded] = useState<Set<string>>(new Set())
```

- [ ] **Step 2: Make group headers clickable toggles**

Replace the `grouped.map(group => ...)` block (lines 343–363) with:

```tsx
grouped.map(group => {
  const isOpen = expanded.has(group.name)
  return (
    <Fragment key={`group-${group.name}`}>
      <tr
        onClick={() =>
          setExpanded(prev => {
            const next = new Set(prev)
            isOpen ? next.delete(group.name) : next.add(group.name)
            return next
          })
        }
        className="bg-gradient-to-r from-blue-50 to-slate-50 border-y border-blue-100 cursor-pointer select-none hover:from-blue-100 hover:to-slate-100 transition-colors"
      >
        <td colSpan={8} className="px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="text-slate-400 text-xs transition-transform duration-200 inline-block"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {group.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-bold text-slate-800 text-sm">{group.name}</span>
            {group.phone && <span className="text-slate-400 text-xs">{group.phone}</span>}
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
              {group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}
            </span>
            <span className="ml-auto text-xs font-semibold text-slate-600">
              Total: ₹{group.invoices.reduce((s, i) => s + i.grand_total, 0).toFixed(2)}
            </span>
          </div>
        </td>
      </tr>
      {isOpen && group.invoices.map(inv => renderInvoiceRow(inv))}
    </Fragment>
  )
})
```

- [ ] **Step 3: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/invoices/InvoiceList.tsx
git commit -m "feat(invoices): collapsable customer accordion groups"
```

---

## Task 2: Invoice Detail — Modern UI

**Annotation:** mq24avm0-am1ky3

**File:** `app/(dashboard)/invoices/[id]/page.tsx` (223 lines)

Current: plain white cards, `bg-card` / `bg-muted` tokens, no colored headers.
Desired: dark gradient page header, blue customer card, dark items table header, violet payment summary header.

- [ ] **Step 1: Replace entire page content**

Rewrite `app/(dashboard)/invoices/[id]/page.tsx` with the following (keep all imports and data fetching, only change JSX from `return (` onward):

```tsx
  return (
    <div className="space-y-5 max-w-4xl">
      {/* Dark header */}
      <div className="rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#111827] via-[#1e2d40] to-[#1a3a5c] px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Link href="/invoices" className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition-colors">
                <ArrowLeftIcon className="size-3.5" /> Invoices
              </Link>
              <h1 className="text-2xl font-black text-white tracking-tight">{invoice.invoice_no}</h1>
              <p className="text-slate-400 text-sm mt-1">
                {format(new Date(invoice.created_at), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <PrintReceiptButton />
                <InvoiceShareButtons
                  invoiceId={invoice.id}
                  invoiceNo={invoice.invoice_no}
                  grandTotal={invoice.grand_total}
                  customerEmail={customer?.email ?? null}
                  customerPhone={customer?.phone ?? null}
                />
              </div>
              {invoice.status !== 'cancelled' && (
                <Link
                  href={`/invoices/${invoice.id}/return`}
                  className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  ↩ Return
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer card */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Customer Details</h2>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              invoice.status === 'paid'
                ? 'bg-emerald-100 text-emerald-700'
                : invoice.status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {invoice.status === 'pending' ? 'Due' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
            <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full capitalize">
              {invoice.payment_method ?? '—'}
            </span>
          </div>
        </div>
        <div className="p-5">
          <p className="font-bold text-lg text-slate-900">{customer ? customer.name : 'Walk-in Customer'}</p>
          {customer?.business_name && <p className="text-sm text-slate-500 mb-3">{customer.business_name}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3">
            {customer?.phone && (
              <div><p className="text-xs text-slate-400 font-medium">Phone</p><p className="font-semibold text-slate-800">{customer.phone}</p></div>
            )}
            {customer?.email && (
              <div><p className="text-xs text-slate-400 font-medium">Email</p><p className="font-semibold text-slate-800 break-all">{customer.email}</p></div>
            )}
            {customer?.gstin && (
              <div><p className="text-xs text-slate-400 font-medium">GSTIN</p><p className="font-semibold text-slate-800 font-mono text-xs">{customer.gstin}</p></div>
            )}
            {customer?.state && (
              <div><p className="text-xs text-slate-400 font-medium">State</p><p className="font-semibold text-slate-800">{customer.state}</p></div>
            )}
            {customer?.address && (
              <div className="col-span-2 sm:col-span-3"><p className="text-xs text-slate-400 font-medium">Address</p><p className="font-semibold text-slate-800">{customer.address}</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="bg-[#111827] px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Invoice Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxable</th>
                {isIGST
                  ? <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">IGST</th>
                  : <>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">CGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">SGST</th>
                    </>
                }
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.product_name}</p>
                    {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                    {item.serial_number && <p className="text-xs text-slate-400 font-mono">S/N: {item.serial_number}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.rate).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.taxable_amount).toFixed(2)}</td>
                  {isIGST
                    ? <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.igst).toFixed(2)}</td>
                    : <>
                        <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.cgst).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.sgst).toFixed(2)}</td>
                      </>
                  }
                  <td className="px-4 py-3 text-right font-bold text-slate-900">₹{round2(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Payment Summary</h2>
        </div>
        <div className="p-5 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span><span>₹{round2(invoice.subtotal).toFixed(2)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>−₹{round2(invoice.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Taxable Amount</span><span>₹{round2(invoice.taxable_amount).toFixed(2)}</span>
            </div>
            {isIGST ? (
              <div className="flex justify-between text-slate-500">
                <span>IGST</span><span>₹{round2(invoice.igst).toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>CGST</span><span>₹{round2(invoice.cgst).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>SGST</span><span>₹{round2(invoice.sgst).toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black text-lg border-t border-slate-200 pt-3 mt-1 bg-slate-50 -mx-5 px-5 py-3 text-slate-900">
              <span>Grand Total</span><span>₹{round2(invoice.grand_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Amount Paid</span>
              <span className="text-emerald-600 font-semibold">₹{round2(invoice.amount_paid).toFixed(2)}</span>
            </div>
            {(() => {
              const due = round2(invoice.grand_total - invoice.amount_paid)
              return due > 0 ? (
                <div className="flex justify-between">
                  <span className="font-bold text-red-600">Balance Due</span>
                  <span className="font-black text-red-600 text-lg">₹{due.toFixed(2)}</span>
                </div>
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Payment History</h2>
        </div>
        <div className="p-5">
          <RecordPaymentDialog
            invoiceId={invoice.id}
            grandTotal={invoice.grand_total}
            amountPaid={invoice.amount_paid}
            payments={payments}
            invoiceStatus={invoice.status}
          />
        </div>
      </div>

      <ThermalReceipt invoice={invoice} />
    </div>
  )
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/invoices/[id]/page.tsx"
git commit -m "feat(invoice-detail): modern UI with colored section headers"
```

---

## Task 3: Print Invoice — Rename + A4

**Annotation:** mq24aa7z-6js7lz

**File:** `components/invoice/PrintReceiptButton.tsx`

Current: label "Print Receipt", calls `window.print()`. Print CSS is thermal-width.
Desired: label "Print Invoice", A4 print layout.

- [ ] **Step 1: Rename button**

Replace `components/invoice/PrintReceiptButton.tsx` entirely:

```tsx
'use client'
import { PrinterIcon } from 'lucide-react'

export function PrintReceiptButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <PrinterIcon className="size-4" />
      Print Invoice
    </button>
  )
}
```

- [ ] **Step 2: Add A4 print media CSS**

Find `app/globals.css` (run `ls app/` to confirm filename). Add at the bottom:

```css
@media print {
  @page { size: A4; margin: 10mm 15mm; }

  /* Hide page chrome, show only print area */
  nav, aside, header, .no-print { display: none !important; }

  /* Expand thermal receipt to A4 width */
  .thermal-receipt-wrapper {
    width: 100% !important;
    max-width: 210mm !important;
    font-size: 11pt !important;
  }
}
```

Then check `components/invoice/ThermalReceipt.tsx` — look for `print:block` or similar class, ensure the print area has class `thermal-receipt-wrapper` if not already.

- [ ] **Step 3: Commit**

```bash
git add components/invoice/PrintReceiptButton.tsx app/globals.css
git commit -m "feat(invoice): rename to Print Invoice + A4 print layout"
```

---

## Task 4: Returns — Delete Button + Inventory Restore Verification

**Annotations:** mq23q2fo-0wfo1v, mq2490m3-wh0ghv

**Files:**
- `app/(dashboard)/returns/page.tsx`
- `actions/sales-returns.ts`

- [ ] **Step 1: Read returns page and actions**

Read `app/(dashboard)/returns/page.tsx` and `actions/sales-returns.ts` to understand current structure.

- [ ] **Step 2: Add delete action if missing**

In `actions/sales-returns.ts`, check for `deleteSalesReturn`. If it doesn't exist, add:

```typescript
export async function deleteSalesReturn(id: string) {
  const supabase = await createClient()
  // Fetch return details to reverse stock
  const { data: ret } = await supabase
    .from('sales_returns')
    .select('product_id, quantity, invoice_id')
    .eq('id', id)
    .single()
  if (ret?.product_id) {
    // Reverse the stock restoration (re-deduct)
    await supabase.rpc('decrement_stock', { p_product_id: ret.product_id, p_qty: ret.quantity })
    // Fallback if no RPC: fetch + update
  }
  const { error } = await supabase.from('sales_returns').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

If `decrement_stock` RPC doesn't exist, use the pattern:
```typescript
const { data: prod } = await supabase.from('products').select('current_stock').eq('id', ret.product_id).single()
if (prod) {
  await supabase.from('products').update({ current_stock: Math.max(0, prod.current_stock - ret.quantity) }).eq('id', ret.product_id)
}
```

- [ ] **Step 3: Verify createSalesReturn restores inventory**

In `actions/sales-returns.ts`, find `createSalesReturn`. Verify it:
1. Increments `products.current_stock` by return quantity
2. If not, add the increment logic

- [ ] **Step 4: Convert returns page table to use client Delete component**

Since `app/(dashboard)/returns/page.tsx` is a server component, create a minimal client component `components/sales-returns/DeleteReturnButton.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { deleteSalesReturn } from '@/actions/sales-returns'

export function DeleteReturnButton({ returnId }: { returnId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this return? This will reverse the stock restoration.')) return
    setLoading(true)
    try {
      await deleteSalesReturn(returnId)
      toast.success('Return deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
    >
      {loading ? '…' : 'Delete'}
    </button>
  )
}
```

In `app/(dashboard)/returns/page.tsx`, add to the actions column next to View link:
```tsx
import { DeleteReturnButton } from '@/components/sales-returns/DeleteReturnButton'
// In each row:
<div className="flex items-center gap-3">
  <Link href={`/returns/${ret.id}`} className="text-xs font-medium text-[#4B5563] hover:underline">View</Link>
  <DeleteReturnButton returnId={ret.id} />
</div>
```

Also add an Actions `<th>` to the table header if it doesn't already have one.

- [ ] **Step 5: TypeScript check + commit**

```
npx tsc --noEmit
git add "app/(dashboard)/returns/page.tsx" actions/sales-returns.ts components/sales-returns/DeleteReturnButton.tsx
git commit -m "feat(returns): delete button + verified inventory restore on return"
```

---

## Task 5: Billing Checkout — Grand Total Color + Light Background + Bigger Fonts

**Annotations:** mq230w1g-ofmqsz, mq2324h5-u0w74d

**Files:** `components/billing/CheckoutForm.tsx`, `app/(dashboard)/billing/checkout/page.tsx`

- [ ] **Step 1: Read checkout page**

Read `app/(dashboard)/billing/checkout/page.tsx` (90 lines) to see current wrapping.

- [ ] **Step 2: Add light background to checkout page**

In `app/(dashboard)/billing/checkout/page.tsx`, wrap the main content area in `bg-slate-50`:

Find the JSX return and add `className="bg-slate-50 min-h-screen py-6 px-4"` to the outermost div, or wrap `<CheckoutForm>` in:
```tsx
<div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
  <CheckoutForm ... />
</div>
```

- [ ] **Step 3: Grand total dark colored band in CheckoutForm**

In `components/billing/CheckoutForm.tsx`, find the grand total row at approximately lines 269–271:
```tsx
<div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 mt-1 text-slate-900">
  <span>Grand Total</span><span>₹{totals.grand_total.toFixed(2)}</span>
</div>
```

Replace with:
```tsx
<div className="flex justify-between items-center font-black bg-gradient-to-r from-slate-800 to-slate-700 text-white -mx-5 px-5 py-4 mt-2 rounded-b-xl">
  <span className="text-base">Grand Total</span>
  <span className="text-2xl">₹{totals.grand_total.toFixed(2)}</span>
</div>
```

- [ ] **Step 4: Increase cart table font sizes**

In `components/billing/CheckoutForm.tsx` cart table (thead/tbody rows around lines 213–239):
- Table `text-sm` → keep but increase product name to `text-base font-semibold`
- Row padding `py-3` → `py-4`
- Serial number stays `text-xs`

- [ ] **Step 5: TypeScript check + commit**

```
npx tsc --noEmit
git add components/billing/CheckoutForm.tsx "app/(dashboard)/billing/checkout/page.tsx"
git commit -m "feat(checkout): grand total color band + light background + bigger cart fonts"
```

---

## Task 6: Products Page — Rounded Search Bar

**Annotation:** mq237mz6-sa4dpk

**File:** `components/products/ProductsTable.tsx`

Current: search input and filter dropdowns are basic, small.
Desired: round shape, background color, bigger.

- [ ] **Step 1: Read ProductsTable.tsx**

Read `components/products/ProductsTable.tsx` fully to find the search bar and filter dropdowns.

- [ ] **Step 2: Wrap search/filters in styled card**

Find the filter bar area. Wrap in a card:
```tsx
<div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
  <div className="flex flex-wrap items-center gap-3">
    {/* existing search + filter inputs */}
  </div>
</div>
```

Update the search input class to:
```
h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400
```

Update filter `<select>` / dropdown buttons to `h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm`.

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/products/ProductsTable.tsx
git commit -m "feat(products): rounded search bar with card background"
```

---

## Task 7: ProductForm — Inline "Add Brand"

**Annotation:** mq23a9rp-8751c0

**File:** `components/products/ProductForm.tsx`

Current: Brand section uses `CAMERA_BRANDS` array, likely shown as a select or inline buttons.
Desired: "Add Brand" as first option; user types new brand, saves locally (localStorage).

- [ ] **Step 1: Read brand section of ProductForm**

Read `components/products/ProductForm.tsx` lines 29–33 (CAMERA_BRANDS) and lines 217–272 (brand UI).

- [ ] **Step 2: Add inline brand creation state**

Near top of `ProductForm` component body, add:

```tsx
const [showAddBrand, setShowAddBrand] = useState(false)
const [newBrand, setNewBrand] = useState('')
const [customBrands, setCustomBrands] = useState<string[]>(() => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('ds-pos-custom-brands') ?? '[]') }
  catch { return [] }
})

const allBrands = [...CAMERA_BRANDS, ...customBrands]

function addCustomBrand() {
  const trimmed = newBrand.trim()
  if (!trimmed) return
  const updated = [...customBrands, trimmed]
  setCustomBrands(updated)
  localStorage.setItem('ds-pos-custom-brands', JSON.stringify(updated))
  setValue('brand', trimmed)  // or however brand value is set via react-hook-form
  setNewBrand('')
  setShowAddBrand(false)
}
```

- [ ] **Step 3: Update brand dropdown/select UI**

Find where brand is rendered (it uses `watch('brand')` or similar). If it's a combobox/select, add "Add Brand" as first item:

```tsx
{/* Add Brand trigger */}
{!showAddBrand && (
  <button
    type="button"
    onClick={() => setShowAddBrand(true)}
    className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-200"
  >
    + Add Brand
  </button>
)}
{showAddBrand && (
  <div className="flex gap-2 items-center">
    <input
      type="text"
      value={newBrand}
      onChange={e => setNewBrand(e.target.value)}
      placeholder="New brand name"
      autoFocus
      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomBrand() } }}
    />
    <button type="button" onClick={addCustomBrand} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700">Add</button>
    <button type="button" onClick={() => setShowAddBrand(false)} className="px-2 py-2 text-slate-400 hover:bg-slate-100 rounded-xl text-sm">✕</button>
  </div>
)}
```

Use `allBrands` instead of `CAMERA_BRANDS` wherever brand list is rendered.

- [ ] **Step 4: TypeScript check + commit**

```
npx tsc --noEmit
git add components/products/ProductForm.tsx
git commit -m "feat(products): inline Add Brand in product form with localStorage persistence"
```

---

## Task 8: SupplierInvoiceList — Modern UI + Collapsable by Supplier

**Annotation:** mq23dg4l-92zn3z

**Files:**
- `components/stock-in/SupplierInvoiceList.tsx`
- `app/(dashboard)/stock-in/page.tsx`

Current: plain small table, basic `Input` / `Button` shadcn, no colored header, no grouping.
Desired: modern colored header (like invoices page), collapsable by supplier name.

- [ ] **Step 1: Add grouping state + computation**

In `SupplierInvoiceList.tsx`, add after existing state:

```tsx
const [expanded, setExpanded] = useState<Set<string>>(new Set())
const [groupBySupplier, setGroupBySupplier] = useState(true)

const grouped = useMemo(() => {
  if (!groupBySupplier) return null
  const map = new Map<string, SupplierInvoice[]>()
  for (const inv of filtered) {
    const key = inv.supplier_name ?? 'Unknown Supplier'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(inv)
  }
  return Array.from(map.entries())
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length)
}, [filtered, groupBySupplier])
```

Add `useMemo, Fragment` to imports.

- [ ] **Step 2: Extract renderInvoiceRow helper**

Before the return statement, add:

```tsx
function renderRow(inv: SupplierInvoice) {
  const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const balance = Number(inv.total_amount) - paid
  return (
    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
      <td className="px-5 py-3.5 text-sm font-medium font-mono text-slate-700">{inv.purchase_invoice_no ?? '—'}</td>
      <td className="px-5 py-3.5 text-sm text-slate-600">{inv.supplier_name ?? '—'}</td>
      <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(inv.purchase_date), 'dd MMM yyyy')}</td>
      <td className="px-5 py-3.5 text-sm text-right tabular-nums">
        <div className="font-semibold text-slate-900">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        {balance > 0 && <div className="text-red-500 text-xs">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>{inv.payment_status}</span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/stock-in/${inv.id}`} className="text-xs font-medium text-[#4B5563] hover:underline">View →</Link>
          <button
            className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
            disabled={deletingId === inv.id}
            onClick={() => handleDelete(inv)}
          >
            {deletingId === inv.id ? '…' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  )
}
```

- [ ] **Step 3: Rewrite the return JSX**

Replace the entire `return (...)` with:

```tsx
return (
  <div className="space-y-5">
    {/* Filter bar */}
    <div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            placeholder="Search supplier or invoice no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
          />
        </div>
        <label className="text-sm text-slate-500 whitespace-nowrap">From</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 w-36" />
        <label className="text-sm text-slate-500 whitespace-nowrap">To</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 w-36" />
        {(search || fromDate || toDate) && (
          <button onClick={() => { setSearch(''); setFromDate(''); setToDate('') }} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm hover:bg-slate-50 transition-colors">Clear</button>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setGroupBySupplier(g => !g)}
            className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition-all shadow-sm ${
              groupBySupplier ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {groupBySupplier ? '▼ By Supplier' : '≡ Flat List'}
          </button>
        </div>
      </div>
    </div>

    {/* Table */}
    {filtered.length === 0 ? (
      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
        <p className="text-sm text-slate-500">{invoices.length === 0 ? 'No supplier invoices yet.' : 'No invoices match your filters.'}</p>
      </div>
    ) : (
      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#111827] border-b border-[#1F2937]">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice No</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupBySupplier && grouped ? (
                grouped.map(group => {
                  const isOpen = expanded.has(group.name)
                  return (
                    <Fragment key={`group-${group.name}`}>
                      <tr
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev)
                          isOpen ? next.delete(group.name) : next.add(group.name)
                          return next
                        })}
                        className="bg-gradient-to-r from-slate-50 to-white border-y border-slate-200 cursor-pointer select-none hover:from-slate-100 transition-colors"
                      >
                        <td colSpan={6} className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-slate-400 text-xs inline-block transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                            <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                              {group.items.length} invoice{group.items.length !== 1 ? 's' : ''}
                            </span>
                            <span className="ml-auto text-xs font-semibold text-slate-600">
                              ₹{group.items.reduce((s, i) => s + Number(i.total_amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isOpen && group.items.map(inv => renderRow(inv))}
                    </Fragment>
                  )
                })
              ) : (
                filtered.map(inv => renderRow(inv))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)
```

Add `SearchIcon, Fragment` to imports. Remove `Button, Input` shadcn imports.

- [ ] **Step 4: Update app/(dashboard)/stock-in/page.tsx**

Read the page. It has a header with buttons + `<SupplierInvoiceList>`. Since SupplierInvoiceList no longer owns its colored page header (that's in the page), keep the page header as-is. The list just needs the filter bar + table to look good. No changes needed to the page file unless it duplicates filter UI.

- [ ] **Step 5: TypeScript check + commit**

```
npx tsc --noEmit
git add components/stock-in/SupplierInvoiceList.tsx
git commit -m "feat(stock-in): modern UI + collapsable supplier accordion"
```

---

## Task 9: StockIn New — Product Search Shows All on Focus

**Annotation:** mq23h5ia-f7mwb9

**File:** `components/stock-in/ProductCombobox.tsx`

Current: dropdown only shows when search string is non-empty.
Desired: on focus, show all products (up to 20) with scroll.

- [ ] **Step 1: Read ProductCombobox.tsx fully**

Read `components/stock-in/ProductCombobox.tsx`.

- [ ] **Step 2: Fix show-on-focus behavior**

Find the `filteredProducts` computation. Change:
```tsx
const filteredProducts = search.trim()
  ? products.filter(p => ...).slice(0, 10)
  : []
```
To:
```tsx
const filteredProducts = search.trim()
  ? products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20)
  : products.slice(0, 20)
```

Find the dropdown visibility condition:
```tsx
{showDropdown && search && filteredProducts.length > 0 && (
```
Change to:
```tsx
{showDropdown && filteredProducts.length > 0 && (
```

Add `max-h-64 overflow-y-auto` to the dropdown container `<div>`.

Update placeholder text to: `"Search product by name or SKU…"` (already has it, keep).

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/stock-in/ProductCombobox.tsx
git commit -m "fix(stock-in): product search shows all items on focus with scroll"
```

---

## Task 10: Stock Adjustments — View/Delete + Search Dropdown Arrow

**Annotations:** mq23lf80-ubq3ln, mq23o2dt-vumoqc

**Files:**
- `app/(dashboard)/stock-adjustments/page.tsx`
- `components/stock-adjustments/StockAdjustmentForm.tsx`
- `actions/stock-adjustments.ts`
- Create: `components/stock-adjustments/StockAdjustmentsListClient.tsx`

- [ ] **Step 1: Check for deleteStockAdjustment in actions**

Read `actions/stock-adjustments.ts`. If `deleteStockAdjustment` doesn't exist, add:

```typescript
export async function deleteStockAdjustment(id: string) {
  const supabase = await createClient()
  const { data: adj } = await supabase
    .from('stock_adjustments')
    .select('product_id, quantity')
    .eq('id', id)
    .single()
  if (adj?.product_id) {
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', adj.product_id)
      .single()
    if (prod) {
      // Reverse the adjustment
      await supabase
        .from('products')
        .update({ current_stock: prod.current_stock - adj.quantity })
        .eq('id', adj.product_id)
    }
  }
  const { error } = await supabase.from('stock_adjustments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create StockAdjustmentsListClient**

Create `components/stock-adjustments/StockAdjustmentsListClient.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { deleteStockAdjustment } from '@/actions/stock-adjustments'
import type { StockAdjustmentType } from '@/types/database'

const TYPE_LABELS: Record<StockAdjustmentType, string> = {
  found: 'Found / Received',
  return: 'Customer Return',
  damage: 'Damage / Loss',
  write_off: 'Write-Off',
  correction: 'Manual Correction',
}

const TYPE_CLASSES: Record<StockAdjustmentType, string> = {
  found: 'bg-emerald-100 text-emerald-700',
  return: 'bg-blue-100 text-blue-700',
  damage: 'bg-red-100 text-red-700',
  write_off: 'bg-red-100 text-red-700',
  correction: 'bg-amber-100 text-amber-700',
}

interface Adj {
  id: string
  products?: { name: string; sku: string } | null
  adjustment_type: string
  quantity: number
  notes: string | null
  created_at: string
}

export function StockAdjustmentsListClient({ adjustments }: { adjustments: Adj[] }) {
  const [items, setItems] = useState(adjustments)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    if (!confirm('Delete this adjustment? This will reverse the stock change.')) return
    setDeletingId(id)
    try {
      await deleteStockAdjustment(id)
      setItems(prev => prev.filter(a => a.id !== id))
      toast.success('Adjustment deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <tbody>
      {items.map((adj, i) => (
        <tr key={adj.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
          <td className="px-4 py-3">
            <p className="font-semibold text-[#111827]">{adj.products?.name ?? '—'}</p>
            <p className="text-xs text-slate-500">{adj.products?.sku}</p>
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_CLASSES[adj.adjustment_type as StockAdjustmentType]}`}>
              {TYPE_LABELS[adj.adjustment_type as StockAdjustmentType]}
            </span>
          </td>
          <td className={`px-4 py-3 text-right font-bold ${adj.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {adj.quantity > 0 ? '+' : ''}{adj.quantity}
          </td>
          <td className="px-4 py-3 text-slate-500 text-sm max-w-xs truncate">
            {adj.notes ?? <span className="text-slate-300">—</span>}
          </td>
          <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
            {format(new Date(adj.created_at), 'dd MMM yyyy')}
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => router.push(`/stock-adjustments/${adj.id}`)}
                className="text-xs font-medium text-[#4B5563] hover:underline"
              >
                View
              </button>
              <button
                onClick={() => handleDelete(adj.id)}
                disabled={deletingId === adj.id}
                className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
              >
                {deletingId === adj.id ? '…' : 'Delete'}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  )
}
```

- [ ] **Step 3: Update stock-adjustments page**

In `app/(dashboard)/stock-adjustments/page.tsx`:
1. Import `StockAdjustmentsListClient`
2. Add `<th>` for Actions column in thead
3. Replace `<tbody>...</tbody>` with `<StockAdjustmentsListClient adjustments={adjustments} />`

- [ ] **Step 4: Add dropdown arrow to StockAdjustmentForm search**

In `components/stock-adjustments/StockAdjustmentForm.tsx`:

Change product search condition from:
```tsx
{showDropdown && search && !productId && filteredProducts.length > 0 && (
```
to:
```tsx
{showDropdown && !productId && filteredProducts.length > 0 && (
```

Change `filteredProducts` to show all on empty search:
```tsx
const filteredProducts = search.trim()
  ? products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10)
  : products.slice(0, 20)
```

Add `ChevronDownIcon` to the search input wrapper:
```tsx
import { ChevronDownIcon } from 'lucide-react'
// ...
<div className="relative">
  <input ... />
  <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
</div>
```

- [ ] **Step 5: TypeScript check + commit**

```
npx tsc --noEmit
git add "app/(dashboard)/stock-adjustments/page.tsx" components/stock-adjustments/StockAdjustmentForm.tsx components/stock-adjustments/StockAdjustmentsListClient.tsx actions/stock-adjustments.ts
git commit -m "feat(stock-adjustments): view/delete buttons + dropdown arrow on search"
```

---

## Task 11: Purchase Orders — Card/Box Style

**Annotation:** mq23t8cg-3ag4bt

**File:** `components/purchase-orders/POForm.tsx`

- [ ] **Step 1: Read POForm.tsx**

Read `components/purchase-orders/POForm.tsx` fully.

- [ ] **Step 2: Wrap each logical section in a card**

For each section (Supplier, Items, Notes/totals, Actions), wrap in:

```tsx
<div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
  <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3.5 flex items-center gap-2">
    <span className="text-white font-bold text-sm">Section Name</span>
  </div>
  <div className="p-5 bg-white space-y-4">
    {/* existing section content */}
  </div>
</div>
```

Use section names: "Supplier Details", "Order Items", "Notes & Actions".

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/purchase-orders/POForm.tsx
git commit -m "feat(purchase-orders): card style with dark section headers"
```

---

## Task 12: Expenses — Inline "Add Category"

**Annotation:** mq23uszk-uqs8z7

**Files:** `components/expenses/ExpenseForm.tsx`, `actions/expenses.ts`

- [ ] **Step 1: Add createExpenseCategory to actions/expenses.ts**

Read `actions/expenses.ts`. Add if missing:

```typescript
export async function createExpenseCategory(name: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name: name.trim() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ExpenseCategory
}
```

- [ ] **Step 2: Update ExpenseForm with inline category creation**

Add state:
```tsx
const [localCategories, setLocalCategories] = useState(categories)
const [showAddCategory, setShowAddCategory] = useState(false)
const [newCategoryName, setNewCategoryName] = useState('')
const [addingCategory, setAddingCategory] = useState(false)
```

Add handler:
```tsx
async function handleAddCategory() {
  const trimmed = newCategoryName.trim()
  if (!trimmed) return
  setAddingCategory(true)
  try {
    const cat = await createExpenseCategory(trimmed)
    setLocalCategories(prev => [...prev, cat])
    setForm(f => ({ ...f, category_id: cat.id }))
    setNewCategoryName('')
    setShowAddCategory(false)
    toast.success(`Category "${cat.name}" created`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create category')
  } finally {
    setAddingCategory(false)
  }
}
```

Replace the category `<select>` with:
```tsx
<div className="space-y-2">
  <select
    value={showAddCategory ? '__add__' : form.category_id}
    onChange={e => {
      if (e.target.value === '__add__') { setShowAddCategory(true); return }
      setForm(f => ({ ...f, category_id: e.target.value }))
    }}
    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white"
    required
  >
    <option value="__add__">+ Add Category</option>
    {localCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
  </select>
  {showAddCategory && (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        value={newCategoryName}
        onChange={e => setNewCategoryName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
        placeholder="New category name"
        autoFocus
        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <button type="button" onClick={handleAddCategory} disabled={addingCategory}
        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
        {addingCategory ? '…' : 'Add'}
      </button>
      <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
        className="px-2 py-2 text-slate-400 hover:bg-slate-100 rounded-xl text-sm">✕</button>
    </div>
  )}
</div>
```

Import `createExpenseCategory` at top.

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/expenses/ExpenseForm.tsx actions/expenses.ts
git commit -m "feat(expenses): inline Add Category with DB persistence"
```

---

## Task 13: Store Loans — Inventory Search + Stock Deduction

**Annotation:** mq23yevh-gayibl

**Files:**
- `components/store-loans/StoreLoanForm.tsx`
- `actions/store-loans.ts`
- `app/(dashboard)/store-loans/new/page.tsx`

- [ ] **Step 1: Add product_id column to store_loans via Supabase MCP**

Use `mcp__supabase__apply_migration` with:

```sql
ALTER TABLE store_loans
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Update CreateStoreLoanData type**

In `actions/store-loans.ts`, find the `CreateStoreLoanData` type. Add:
```typescript
product_id?: string | null
```

- [ ] **Step 3: Update createStoreLoan to deduct stock**

In `actions/store-loans.ts`, after inserting the loan, add:

```typescript
// Deduct from inventory for lent_out with a linked product
if (data.product_id && data.direction === 'lent_out') {
  const { data: prod } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', data.product_id)
    .single()
  if (prod) {
    await supabase
      .from('products')
      .update({ current_stock: Math.max(0, prod.current_stock - data.quantity) })
      .eq('id', data.product_id)
  }
}
```

Find the `markReturned` action. Add inverse:
```typescript
// Restore stock when returned
if (loan.product_id && loan.direction === 'lent_out') {
  const { data: prod } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', loan.product_id)
    .single()
  if (prod) {
    await supabase
      .from('products')
      .update({ current_stock: prod.current_stock + loan.quantity })
      .eq('id', loan.product_id)
  }
}
```

- [ ] **Step 4: Update StoreLoanForm to accept products prop**

Change signature:
```tsx
import type { Product } from '@/types/database'

interface StoreLoanFormProps {
  products: Product[]
}

export function StoreLoanForm({ products }: StoreLoanFormProps) {
```

Add state:
```tsx
const [productSearch, setProductSearch] = useState('')
const [showProductDropdown, setShowProductDropdown] = useState(false)
const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

const filteredInventory = productSearch.trim()
  ? products.filter(p =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 20)
  : products.slice(0, 20)
```

Replace the plain product input with the combobox:
```tsx
<div className="space-y-1.5">
  <label className="text-sm font-medium text-slate-700">Product / Item</label>
  <div className="relative">
    <input
      type="text"
      value={form.product_name}
      onChange={e => {
        setProductSearch(e.target.value)
        setForm(f => ({ ...f, product_name: e.target.value }))
        setSelectedProductId(null)
        setShowProductDropdown(true)
      }}
      onFocus={() => setShowProductDropdown(true)}
      onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
      placeholder="Search inventory or type custom item..."
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] pr-8"
      required
    />
    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    {showProductDropdown && filteredInventory.length > 0 && (
      <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
        {filteredInventory.map(p => (
          <button
            key={p.id}
            type="button"
            onMouseDown={() => {
              setSelectedProductId(p.id)
              setForm(f => ({ ...f, product_name: p.name }))
              setProductSearch(p.name)
              setShowProductDropdown(false)
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
          >
            <span className="font-medium text-slate-800">{p.name}</span>
            <span className="text-slate-400 text-xs">{p.sku} · {p.current_stock} in stock</span>
          </button>
        ))}
      </div>
    )}
  </div>
  {selectedProductId && (
    <p className="text-xs text-blue-600 font-medium">✓ Linked to inventory — stock will be deducted on save</p>
  )}
</div>
```

Import `ChevronDownIcon` from lucide-react.

Update `handleSubmit` to pass `product_id`:
```tsx
const loan = await createStoreLoan({ ...form, product_id: selectedProductId })
```

- [ ] **Step 5: Update store-loans/new/page.tsx**

Read `app/(dashboard)/store-loans/new/page.tsx` (14 lines). Add products fetch:

```tsx
import { getProducts } from '@/actions/products'
// ...
const products = await getProducts()
return (
  // ...
  <StoreLoanForm products={products} />
)
```

- [ ] **Step 6: TypeScript check + commit**

```
npx tsc --noEmit
git add components/store-loans/StoreLoanForm.tsx actions/store-loans.ts "app/(dashboard)/store-loans/new/page.tsx"
git commit -m "feat(store-loans): inventory search combobox + stock deduction on loan/return"
```

---

## Task 14: CustomerList — Collapsable Accordion Cards

**Annotation:** mq242dzu-0jfxjw

**File:** `components/customers/CustomerList.tsx`

Current: flat table. Desired: accordion cards — click customer to expand details + actions.

- [ ] **Step 1: Add accordion state**

```tsx
const [expanded, setExpanded] = useState<Set<string>>(new Set())
```

- [ ] **Step 2: Replace table with accordion cards**

Replace the table wrapper `<div className="rounded-2xl bg-white ..."><table>...</table></div>` with:

```tsx
<div className="space-y-2">
  {filtered.map(c => {
    const isOpen = expanded.has(c.id)
    return (
      <div key={c.id} className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        {/* Header row */}
        <div
          onClick={() => setExpanded(prev => {
            const next = new Set(prev)
            isOpen ? next.delete(c.id) : next.add(c.id)
            return next
          })}
          className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
        >
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">{c.name}</p>
            {c.business_name && <p className="text-xs text-slate-500">{c.business_name}</p>}
          </div>
          <p className="text-sm text-slate-500 hidden sm:block">{c.phone ?? '—'}</p>
          <p className="text-sm text-slate-500 hidden md:block">{c.email ?? '—'}</p>
          <p className="text-xs text-slate-400 hidden lg:block">{c.state}</p>
          <span
            className="text-slate-300 ml-2 text-xs inline-block transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
        </div>
        {/* Expanded details */}
        {isOpen && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-4">
              {c.email && (
                <div><p className="text-xs text-slate-400 font-medium">Email</p><p className="font-semibold text-slate-800">{c.email}</p></div>
              )}
              {c.phone && (
                <div><p className="text-xs text-slate-400 font-medium">Phone</p><p className="font-semibold text-slate-800">{c.phone}</p></div>
              )}
              {c.state && (
                <div><p className="text-xs text-slate-400 font-medium">State</p><p className="font-semibold text-slate-800">{c.state}</p></div>
              )}
              {c.gstin && (
                <div><p className="text-xs text-slate-400 font-medium">GSTIN</p><p className="font-mono text-xs font-semibold text-slate-800">{c.gstin}</p></div>
              )}
              {c.address && (
                <div className="col-span-2 sm:col-span-3"><p className="text-xs text-slate-400 font-medium">Address</p><p className="font-semibold text-slate-800">{c.address}</p></div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/customers/${c.id}`} className="text-xs font-semibold text-blue-600 hover:underline">View Details</Link>
              <Link href={`/customers/${c.id}/edit`} className="text-xs font-medium text-slate-500 hover:underline">Edit</Link>
              <button
                onClick={() => handleDelete(c)}
                disabled={pending}
                className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    )
  })}
</div>
```

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/customers/CustomerList.tsx
git commit -m "feat(customers): collapsable accordion cards with expandable details"
```

---

## Task 15: LowStockWidget — Lighter Color + Collapsable

**Annotation:** mq24ijvr-gll5u6

**Files:**
- Create: `components/dashboard/LowStockWidgetClient.tsx`
- Modify: `components/dashboard/LowStockWidget.tsx`

Current: hard amber gradient header looks garish. No collapse.

- [ ] **Step 1: Create LowStockWidgetClient.tsx**

```tsx
'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon, AlertTriangleIcon } from 'lucide-react'

export function LowStockWidgetClient({ children, count }: { children: ReactNode; count: number }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 hover:from-amber-100 hover:to-orange-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangleIcon className="size-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-amber-900 text-sm leading-tight">Low Stock Alert</h2>
            <p className="text-amber-700 text-xs">{count} items need attention</p>
          </div>
        </div>
        <ChevronDownIcon className={`size-4 text-amber-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && <>{children}</>}
    </div>
  )
}
```

- [ ] **Step 2: Update LowStockWidget.tsx**

Replace the entire return block:

```tsx
import { LowStockWidgetClient } from './LowStockWidgetClient'

export async function LowStockWidget() {
  const items = await getLowStockProducts()
  if (items.length === 0) return null

  const outOfStock = items.filter(p => p.current_stock === 0).length
  const lowCount = items.length - outOfStock

  return (
    <LowStockWidgetClient count={items.length}>
      {/* Stats */}
      <div className="grid grid-cols-2 divide-x divide-amber-100 border-b border-amber-100 bg-amber-50/30">
        <div className="px-4 py-3 text-center">
          <p className="text-2xl font-black text-red-500">{outOfStock}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Out of Stock</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-2xl font-black text-amber-500">{lowCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Running Low</p>
        </div>
      </div>
      {/* Top 4 */}
      <div className="px-5 py-3 space-y-2.5">
        {items.slice(0, 4).map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
              {p.categories?.name && <p className="text-xs text-slate-400">{p.categories.name}</p>}
            </div>
            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
              p.current_stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {p.current_stock === 0 ? 'Out' : `${p.current_stock} left`}
            </span>
          </div>
        ))}
        {items.length > 4 && (
          <p className="text-xs text-slate-400 text-center pt-0.5">+{items.length - 4} more items</p>
        )}
      </div>
      {/* CTA */}
      <div className="px-5 pb-4 pt-1">
        <Link
          href="/products?filter=low-stock"
          className="flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          View All Low Stock
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </LowStockWidgetClient>
  )
}
```

Remove the old `AlertTriangleIcon` header div. Keep all imports.

- [ ] **Step 3: TypeScript check + commit**

```
npx tsc --noEmit
git add components/dashboard/LowStockWidget.tsx components/dashboard/LowStockWidgetClient.tsx
git commit -m "feat(dashboard): low stock widget lighter amber color + collapsable"
```

---

## Task 16: Dashboard — More Widget Options (Labels/Customers/Suppliers)

**Annotation:** mq24kbbb-zmbyu6

**Files:**
- `components/dashboard/useDashboardWidgets.ts`
- `components/dashboard/DashboardWidgets.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- Create: `components/dashboard/LabelsQuickWidget.tsx`
- Create: `components/dashboard/CustomersQuickWidget.tsx`
- Create: `components/dashboard/SuppliersQuickWidget.tsx`

- [ ] **Step 1: Add 3 new widget IDs to useDashboardWidgets.ts**

Add 3 entries to `WIDGET_DEFS` (new ones default OFF):

```typescript
export const WIDGET_DEFS = [
  { id: 'stat_cards',         label: 'Stats Overview',       desc: '5 key business metrics' },
  { id: 'invoice_quick',      label: 'Invoice Quick Access', desc: "Today's & pending invoices" },
  { id: 'store_loans',        label: 'Store Loans',          desc: 'Active loans summary' },
  { id: 'revenue_chart',      label: 'Revenue Chart',        desc: '30-day revenue trend' },
  { id: 'low_stock',          label: 'Low Stock Alerts',     desc: 'Products running low' },
  { id: 'expenses',           label: 'Expenses This Month',  desc: 'Monthly expense overview' },
  { id: 'customer_dues',      label: 'Customer Dues',        desc: 'Outstanding customer payments' },
  { id: 'supplier_payments',  label: 'Supplier Payments',    desc: 'Pending supplier invoices' },
  { id: 'labels_quick',       label: 'Label Printer',        desc: 'Quick access to barcode labels' },
  { id: 'customers_quick',    label: 'Customers Summary',    desc: 'Total customers overview' },
  { id: 'suppliers_quick',    label: 'Suppliers Summary',    desc: 'Active suppliers overview' },
] as const
```

Update `getDefaults` to default new ones to `false`:

```typescript
function getDefaults(): Record<WidgetId, boolean> {
  const defaultOff = new Set<WidgetId>(['labels_quick', 'customers_quick', 'suppliers_quick'])
  return Object.fromEntries(
    WIDGET_DEFS.map(w => [w.id, !defaultOff.has(w.id)])
  ) as Record<WidgetId, boolean>
}
```

- [ ] **Step 2: Create LabelsQuickWidget.tsx**

```tsx
import Link from 'next/link'
import { TagIcon } from 'lucide-react'

export function LabelsQuickWidget() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <TagIcon className="size-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Label Printer</p>
          <p className="text-xs text-slate-500">Print barcode labels</p>
        </div>
      </div>
      <Link href="/labels" className="text-xs font-semibold text-blue-600 hover:underline">Open →</Link>
    </div>
  )
}
```

- [ ] **Step 3: Create CustomersQuickWidget.tsx**

```tsx
import Link from 'next/link'
import { UsersIcon } from 'lucide-react'
import { getCustomers } from '@/actions/customers'

export async function CustomersQuickWidget() {
  const customers = await getCustomers()
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <UsersIcon className="size-5 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Customers</p>
          <p className="text-xs text-slate-500">{customers.length} total</p>
        </div>
      </div>
      <Link href="/customers" className="text-xs font-semibold text-blue-600 hover:underline">View All →</Link>
    </div>
  )
}
```

- [ ] **Step 4: Create SuppliersQuickWidget.tsx**

First check `actions/suppliers.ts` for the correct function name (likely `getSuppliers`).

```tsx
import Link from 'next/link'
import { TruckIcon } from 'lucide-react'
import { getSuppliers } from '@/actions/suppliers'

export async function SuppliersQuickWidget() {
  const suppliers = await getSuppliers()
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <TruckIcon className="size-5 text-slate-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Suppliers</p>
          <p className="text-xs text-slate-500">{suppliers.length} total</p>
        </div>
      </div>
      <Link href="/suppliers" className="text-xs font-semibold text-blue-600 hover:underline">View All →</Link>
    </div>
  )
}
```

- [ ] **Step 5: Update DashboardWidgets.tsx**

Add 3 new props to interface and body:

```tsx
interface Props {
  // ... existing 8 ...
  labelsQuick: ReactNode
  customersQuick: ReactNode
  suppliersQuick: ReactNode
}

// In render:
{w('labels_quick', labelsQuick)}
{w('customers_quick', customersQuick)}
{w('suppliers_quick', suppliersQuick)}
```

- [ ] **Step 6: Update dashboard/page.tsx**

Import new widgets and pass to `<DashboardWidgets>`:

```tsx
import { LabelsQuickWidget } from '@/components/dashboard/LabelsQuickWidget'
import { CustomersQuickWidget } from '@/components/dashboard/CustomersQuickWidget'
import { SuppliersQuickWidget } from '@/components/dashboard/SuppliersQuickWidget'

// In JSX:
<DashboardWidgets
  // ... existing 8 props ...
  labelsQuick={<LabelsQuickWidget />}
  customersQuick={<CustomersQuickWidget />}
  suppliersQuick={<SuppliersQuickWidget />}
/>
```

- [ ] **Step 7: TypeScript check + commit**

```
npx tsc --noEmit
git add components/dashboard/useDashboardWidgets.ts components/dashboard/DashboardWidgets.tsx "app/(dashboard)/dashboard/page.tsx" components/dashboard/LabelsQuickWidget.tsx components/dashboard/CustomersQuickWidget.tsx components/dashboard/SuppliersQuickWidget.tsx
git commit -m "feat(dashboard): add Labels/Customers/Suppliers as optional widgets"
```

---

## Task 17: Resolve All Agentation Annotations

After all tasks above are implemented and committed:

- [ ] **Step 1: Resolve all annotation IDs via MCP**

For each of the 21 IDs, call `mcp__agentation__agentation_resolve`:
- mq230w1g-ofmqsz (checkout grand total)
- mq2324h5-u0w74d (checkout light background)
- mq2356su-f4owlu (invoices collapsable)
- mq237mz6-sa4dpk (products search bar)
- mq23a9rp-8751c0 (product brand add)
- mq23dg4l-92zn3z (stock-in modern UI)
- mq23h5ia-f7mwb9 (stock-in search fix)
- mq23lf80-ubq3ln (adjustments view/delete)
- mq23o2dt-vumoqc (adjustments search dropdown)
- mq23q2fo-0wfo1v (returns delete)
- mq23t8cg-3ag4bt (purchase orders card)
- mq23uszk-uqs8z7 (expenses add category)
- mq23yevh-gayibl (store loans inventory)
- mq242dzu-0jfxjw (customers collapsable)
- mq2490m3-wh0ghv (invoice return update)
- mq24aa7z-6js7lz (print A4)
- mq24avm0-am1ky3 (invoice modern UI)
- mq24cgwx-mg502p (invoices collapsable 2)
- mq24ijvr-gll5u6 (low stock widget)
- mq24kbbb-zmbyu6 (dashboard more widgets)
- mq1523yf-sveapr (quotations — already fixed)

---

## Final Verification

- [ ] Run `npm run lint` — fix all errors
- [ ] Run `npx tsc --noEmit` — zero TypeScript errors
- [ ] Run `npm run build` — successful build
- [ ] Start dev server: `npm run dev`
- [ ] Playwright smoke test: navigate to /invoices, /billing/checkout, /products, /stock-in, /stock-adjustments, /returns, /expenses/new, /store-loans/new, /customers, /dashboard
- [ ] Verify no console errors on any page
