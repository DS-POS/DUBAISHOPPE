# GST Config + Mixed Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `is_taxable` flag to products so non-GST accessories show `—` in GST column and are listed by name+price in the invoice footer instead of inflating the taxable amount.

**Architecture:** Single boolean `is_taxable` on products (default true). Billing engine skips GST calculation for non-taxable items. CartSummary shows new layout: taxable subtotal → CGST → SGST/IGST → non-taxable items by name+price → Grand Total. Invoice PDF mirrors this layout.

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, @react-pdf/renderer (existing)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/008_gst_config.sql` | CREATE — add is_taxable to products + invoice_items |
| `types/database.ts` | Modify — add is_taxable to Product + InvoiceItem |
| `lib/gst.ts` | Modify — handle is_taxable in calculateLineGST |
| `components/billing/types.ts` | Modify — add is_taxable to CartItem, update recalcItem + cartTotals |
| `components/billing/CartItemRow.tsx` | Modify — show `—` when !is_taxable |
| `components/billing/CartSummary.tsx` | Modify — new footer layout |
| `components/billing/BillingForm.tsx` | Modify — pass nonTaxableItems to CartSummary |
| `actions/invoices.ts` | Modify — add is_taxable to CreateInvoiceItem |
| `app/(dashboard)/products/new/page.tsx` | Modify — add is_taxable toggle |
| `app/(dashboard)/products/[id]/edit/page.tsx` | Modify — add is_taxable toggle |
| `components/invoice/InvoicePDF.tsx` | Modify — new footer layout |

---

### Task 1: DB Migration — add is_taxable

**Files:**
- Create: `supabase/migrations/008_gst_config.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 008_gst_config.sql
-- Add is_taxable flag to products (default true = all existing products unchanged)
alter table public.products
  add column if not exists is_taxable boolean not null default true;

-- Store is_taxable per invoice line (snapshot at invoice time, product may change later)
alter table public.invoice_items
  add column if not exists is_taxable boolean not null default true;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above. Project ref: `lzvyzfwbsssvofrjbndx`.

- [ ] **Step 3: Verify columns exist**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name in ('products', 'invoice_items')
  and column_name = 'is_taxable';
```

Expected: 2 rows, both boolean, default true.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_gst_config.sql
git commit -m "feat(gst): add is_taxable column to products + invoice_items"
```

---

### Task 2: Types + GST lib

**Files:**
- Modify: `types/database.ts`
- Modify: `lib/gst.ts`

- [ ] **Step 1: Update Product interface in types/database.ts**

Add after `serial_required: boolean`:
```typescript
is_taxable: boolean
```

- [ ] **Step 2: Update InvoiceItem interface in types/database.ts**

Add after `gst_rate: number`:
```typescript
is_taxable: boolean
```

- [ ] **Step 3: Update lib/gst.ts — add is_taxable to GSTLineItem**

Replace the `GSTLineItem` interface:
```typescript
export interface GSTLineItem {
  rate: number
  quantity: number
  discount: number
  gst_rate: number
  is_taxable?: boolean  // undefined treated as true (backwards compat)
}
```

- [ ] **Step 4: Update calculateLineGST to short-circuit for non-taxable items**

Replace the function body:
```typescript
export function calculateLineGST(item: GSTLineItem, customerState: string): GSTCalculated {
  const gross = item.rate * item.quantity
  const net = gross - item.discount

  if (item.is_taxable === false) {
    return {
      taxable_amount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total_gst: 0,
      total: round2(net),
    }
  }

  const isIntraState = customerState.toLowerCase() === 'telangana'
  const gst_amount = net * (item.gst_rate / 100)
  let cgst = 0, sgst = 0, igst = 0
  if (isIntraState) {
    cgst = gst_amount / 2
    sgst = gst_amount / 2
  } else {
    igst = gst_amount
  }
  return {
    taxable_amount: round2(net),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    total_gst: round2(gst_amount),
    total: round2(net + gst_amount),
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add types/database.ts lib/gst.ts
git commit -m "feat(gst): is_taxable type + calculateLineGST short-circuit"
```

---

### Task 3: Billing cart types + recalcItem

**Files:**
- Modify: `components/billing/types.ts`

- [ ] **Step 1: Add is_taxable to CartItem interface**

After `serial_number: string | null` add:
```typescript
is_taxable: boolean
```

- [ ] **Step 2: Update recalcItem to pass is_taxable to calculateLineGST**

Replace the `recalcItem` function:
```typescript
export function recalcItem(
  item: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total' | 'discount'>,
  customerState: string
): CartItem {
  const discount =
    item.discount_mode === 'percent'
      ? Number((item.rate * item.quantity * item.discount_raw / 100).toFixed(2))
      : item.discount_raw
  const gst = calculateLineGST(
    {
      rate: item.rate,
      quantity: item.quantity,
      discount,
      gst_rate: item.product.gst_rate,
      is_taxable: item.is_taxable,
    },
    customerState
  )
  return { ...item, discount, ...gst }
}
```

- [ ] **Step 3: Update cartTotals to return nonTaxableItems**

Replace `cartTotals`:
```typescript
export interface NonTaxableLineItem {
  name: string
  qty: number
  total: number
}

export function cartTotals(items: CartItem[]) {
  const taxable = items.filter(i => i.is_taxable)
  const nonTaxable = items.filter(i => !i.is_taxable)
  return {
    subtotal: items.reduce((s, i) => s + i.rate * i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discount, 0),
    taxable_amount: taxable.reduce((s, i) => s + i.taxable_amount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    total_gst: items.reduce((s, i) => s + i.total_gst, 0),
    grand_total: items.reduce((s, i) => s + i.total, 0),
    non_taxable_items: nonTaxable.map(i => ({
      name: i.product.name,
      qty: i.quantity,
      total: i.total,
    })),
  }
}
```

- [ ] **Step 4: Update BillingForm.tsx — set is_taxable when adding product to cart**

In `addProduct`, replace the `newItem` definition:
```typescript
const newItem: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total' | 'discount'> = {
  _id: crypto.randomUUID(),
  product,
  quantity: 1,
  rate: product.selling_price,
  discount_mode: 'percent',
  discount_raw: 0,
  serial_number: null,
  is_taxable: product.is_taxable,  // ← new
}
```

- [ ] **Step 5: Commit**

```bash
git add components/billing/types.ts components/billing/BillingForm.tsx
git commit -m "feat(gst): is_taxable in CartItem + cartTotals returns nonTaxableItems"
```

---

### Task 4: CartItemRow — show `—` for non-taxable

**Files:**
- Modify: `components/billing/CartItemRow.tsx`

- [ ] **Step 1: Replace GST% cell to show `—` when not taxable**

Replace the GST% `<td>`:
```tsx
<td className="px-4 py-3 w-20 text-right text-xs text-slate-400 font-medium">
  {item.is_taxable ? `${item.product.gst_rate}%` : '—'}
</td>
```

- [ ] **Step 2: Replace Total cell to hide GST line when not taxable**

Replace the Total `<td>`:
```tsx
<td className="px-4 py-3 w-24 text-right">
  <p className="text-sm font-bold text-slate-900">₹{item.total.toFixed(2)}</p>
  {item.is_taxable && (
    <p className="text-xs text-slate-400">GST: ₹{item.total_gst.toFixed(2)}</p>
  )}
</td>
```

- [ ] **Step 3: Commit**

```bash
git add components/billing/CartItemRow.tsx
git commit -m "feat(gst): CartItemRow shows — for non-taxable GST column"
```

---

### Task 5: CartSummary — new footer layout

**Files:**
- Modify: `components/billing/CartSummary.tsx`

- [ ] **Step 1: Update CartSummaryProps to accept nonTaxableItems**

Replace the interface:
```typescript
import type { NonTaxableLineItem } from './types'

interface CartSummaryProps {
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  itemCount: number
  discount: number
  non_taxable_items: NonTaxableLineItem[]
}
```

- [ ] **Step 2: Replace the entire CartSummary return JSX**

```tsx
export function CartSummary({
  taxable_amount, cgst, sgst, igst, grand_total, itemCount, discount, non_taxable_items
}: CartSummaryProps) {
  const isIGST = igst > 0
  const hasNonTaxable = non_taxable_items.length > 0
  const hasTaxable = taxable_amount > 0

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-5 space-y-2.5 text-sm">
      {discount > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Discount</span>
          <span className="font-semibold text-emerald-600">−₹{round2(discount).toFixed(2)}</span>
        </div>
      )}
      {hasTaxable && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Taxable Amount</span>
          <span className="font-medium text-slate-700">₹{round2(taxable_amount).toFixed(2)}</span>
        </div>
      )}
      {hasTaxable && (isIGST ? (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">IGST</span>
          <span className="font-medium text-slate-700">₹{round2(igst).toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">CGST</span>
            <span className="font-medium text-slate-700">₹{round2(cgst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">SGST</span>
            <span className="font-medium text-slate-700">₹{round2(sgst).toFixed(2)}</span>
          </div>
        </>
      ))}
      {hasNonTaxable && non_taxable_items.map((item, idx) => (
        <div key={idx} className="flex justify-between items-center">
          <span className="text-slate-500 truncate max-w-[180px]">
            {item.name}{item.qty > 1 ? ` ×${item.qty}` : ''}
          </span>
          <span className="font-medium text-slate-700">₹{round2(item.total).toFixed(2)}</span>
        </div>
      ))}
      <div className="h-px bg-slate-100 my-1" />
      <div className="flex justify-between items-center">
        <span className="font-bold text-slate-900 text-base">
          Grand Total ({itemCount} item{itemCount !== 1 ? 's' : ''})
        </span>
        <span className="font-black text-[#111827] text-xl">₹{round2(grand_total).toFixed(2)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update BillingForm.tsx — pass new props to CartSummary**

In `BillingForm`, `const totals = cartTotals(cart)` already computes everything. Update the CartSummary usage:
```tsx
<CartSummary
  taxable_amount={totals.taxable_amount}
  cgst={totals.cgst}
  sgst={totals.sgst}
  igst={totals.igst}
  total_gst={totals.total_gst}
  grand_total={totals.grand_total}
  itemCount={cart.length}
  discount={totals.discount}
  non_taxable_items={totals.non_taxable_items}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/billing/CartSummary.tsx components/billing/BillingForm.tsx
git commit -m "feat(gst): CartSummary new layout — taxable+GST lines then non-taxable items by name"
```

---

### Task 6: Invoice action — store is_taxable per line

**Files:**
- Modify: `actions/invoices.ts`

- [ ] **Step 1: Add is_taxable to CreateInvoiceItem**

In `CreateInvoiceItem` interface, add:
```typescript
is_taxable: boolean
```

- [ ] **Step 2: Pass is_taxable when inserting invoice_items**

In the invoice items insert array (inside `createInvoice`), add `is_taxable: item.is_taxable` to each item object in the `.insert()` call.

- [ ] **Step 3: Update CheckoutForm to include is_taxable from cart items**

In `app/(dashboard)/billing/checkout/page.tsx` or `CheckoutForm.tsx`, when building `CreateInvoiceItem` from cart, pass `is_taxable: item.is_taxable`.

- [ ] **Step 4: Commit**

```bash
git add actions/invoices.ts
git commit -m "feat(gst): store is_taxable per invoice line item"
```

---

### Task 7: Products form — is_taxable toggle

**Files:**
- Modify: `app/(dashboard)/products/new/page.tsx` or the shared ProductForm component

- [ ] **Step 1: Find the product form component**

Check if there is a shared `components/products/ProductForm.tsx`. If yes, edit that. If not, edit `app/(dashboard)/products/new/page.tsx`.

- [ ] **Step 2: Add is_taxable toggle to the form**

Add this field in the GST section of the product form, before the GST rate selector:
```tsx
{/* is_taxable toggle */}
<div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
  <input
    type="checkbox"
    id="is_taxable"
    checked={form.watch('is_taxable') ?? true}
    onChange={e => form.setValue('is_taxable', e.target.checked)}
    className="size-4 rounded"
  />
  <label htmlFor="is_taxable" className="text-sm font-medium text-slate-700 cursor-pointer">
    Apply GST on this product
  </label>
  {!form.watch('is_taxable') && (
    <span className="ml-auto text-xs text-amber-600 font-medium">No GST</span>
  )}
</div>
```

- [ ] **Step 3: Add is_taxable to the Zod schema**

In the product form schema, add:
```typescript
is_taxable: z.boolean().default(true),
```

- [ ] **Step 4: Hide GST rate field when is_taxable = false**

Wrap the GST rate input in:
```tsx
{form.watch('is_taxable') && (
  // existing gst_rate + hsn_code fields
)}
```

- [ ] **Step 5: Add is_taxable to server action for creating/updating product**

In `actions/products.ts` createProduct and updateProduct, include `is_taxable` in the insert/update payload.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/products components/products actions/products.ts
git commit -m "feat(gst): is_taxable toggle on product form"
```

---

### Task 8: Invoice PDF — new footer layout

**Files:**
- Modify: `components/invoice/InvoicePDF.tsx` (or wherever @react-pdf PDF is defined)

- [ ] **Step 1: Find the PDF component**

Run: `grep -r "react-pdf\|@react-pdf" --include="*.tsx" -l`

- [ ] **Step 2: Update footer totals section in PDF**

Replace the existing totals block with:
```tsx
{/* Taxable amount + GST */}
{taxableAmount > 0 && (
  <>
    <SummaryRow label="Taxable Amount" value={fmt(taxableAmount)} />
    {isIGST
      ? <SummaryRow label="IGST" value={fmt(invoice.igst)} />
      : <>
          <SummaryRow label={`CGST`} value={fmt(invoice.cgst)} />
          <SummaryRow label={`SGST`} value={fmt(invoice.sgst)} />
        </>
    }
  </>
)}
{/* Non-taxable items by name */}
{nonTaxableItems.map((item, i) => (
  <SummaryRow
    key={i}
    label={`${item.product_name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`}
    value={fmt(item.total)}
  />
))}
{/* Grand total */}
<SummaryRow label="Grand Total" value={fmt(invoice.grand_total)} bold />
```

Where `nonTaxableItems = invoice.invoice_items?.filter(i => !i.is_taxable) ?? []`
And `taxableAmount = invoice.taxable_amount`

- [ ] **Step 3: Commit**

```bash
git add components/invoice/
git commit -m "feat(gst): invoice PDF new footer — taxable+GST then non-taxable items by name"
```

---

### Task 9: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run dev server and test**

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

Test:
1. Go to Products → New — verify "Apply GST" checkbox visible, unchecking it hides GST rate field
2. Create a non-taxable product (e.g. "Light Stand", no GST)
3. Go to Billing — add Sony camera (18% GST) + Light Stand (no GST)
4. Verify CartItemRow shows `—` for Light Stand GST column
5. Verify CartSummary shows: Taxable Amount → CGST → SGST → "Light Stand" price → Grand Total
6. Create invoice → open invoice detail → verify PDF footer shows same layout

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(gst): complete mixed billing — non-taxable items show — in GST, listed by name in footer"
```
