# Sales Returns / Credit Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to process product returns against existing invoices — restoring stock, marking serials as returned, generating a credit note, and recording the refund method.

**Architecture:** New `sales_returns` + `sales_return_items` tables. A server action validates quantities (cannot exceed original, cannot re-return already-returned), atomically restores stock and serial status, and inserts the return record. Return number is `RET-000001` format via a Supabase sequence. Return detail page shows credit note. Invoice detail page shows a "Process Return" button.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind, `@react-pdf/renderer` (already installed)

**Security:** All mutations require auth. Quantity validation server-side. Cannot return against cancelled invoices. RLS on both return tables.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| Supabase migration | Apply | `sales_returns` + `sales_return_items` + `next_return_no()` RPC + RLS |
| `types/database.ts` | Modify | Add `SalesReturn`, `SalesReturnItem` interfaces + `ReturnRefundMethod` type |
| `lib/invoice-number.ts` | Modify | Add `formatReturnNo` |
| `actions/sales-returns.ts` | Create | `createSalesReturn`, `getSalesReturns`, `getSalesReturn` |
| `components/sales-returns/ReturnForm.tsx` | Create | Client component — select items/qty, refund method, reason |
| `app/(dashboard)/invoices/[id]/return/page.tsx` | Create | Loads invoice, renders ReturnForm |
| `app/(dashboard)/returns/page.tsx` | Create | List all returns |
| `app/(dashboard)/returns/[id]/page.tsx` | Create | Return detail / credit note view |
| `app/(dashboard)/invoices/[id]/page.tsx` | Modify | Add "Return" button |
| `components/layout/Sidebar.tsx` | Modify | Add Returns nav link |

---

### Task 1: DB migration — sales_returns tables + RPC + RLS

- [ ] **Step 1: Apply Supabase migration via MCP**

Migration name: `sales_returns_tables`

```sql
-- Returns sequence for RET-000001 format
CREATE SEQUENCE IF NOT EXISTS sales_return_seq START 1;

-- returns header
CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash', 'upi', 'card', 'bank_transfer', 'store_credit', 'no_refund')),
  total_refund NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- return line items
CREATE TABLE IF NOT EXISTS sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES invoice_items(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  serial_number TEXT,
  quantity_returned INT NOT NULL CHECK (quantity_returned > 0),
  rate NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- RPC for atomic return number
CREATE OR REPLACE FUNCTION next_return_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq_val BIGINT;
BEGIN
  SELECT nextval('sales_return_seq') INTO seq_val;
  RETURN 'RET-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_invoice_item ON sales_return_items(invoice_item_id);

-- RLS
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_sales_returns" ON sales_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_sales_return_items" ON sales_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verify tables exist**

Run `SELECT table_name FROM information_schema.tables WHERE table_name IN ('sales_returns','sales_return_items');` — should return 2 rows.

---

### Task 2: Types + formatReturnNo

**Files:**
- Modify: `types/database.ts`
- Modify: `lib/invoice-number.ts`

- [ ] **Step 1: Add types to `types/database.ts`**

Add after `export type StockAdjustmentType`:
```typescript
export type ReturnRefundMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'store_credit' | 'no_refund'
```

Add after `StockAdjustment` interface:
```typescript
export interface SalesReturnItem {
  id: string
  return_id: string
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  quantity_returned: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface SalesReturn {
  id: string
  return_no: string
  invoice_id: string
  reason: string
  refund_method: ReturnRefundMethod
  total_refund: number
  notes: string | null
  created_by: string | null
  created_at: string
  invoices?: Pick<Invoice, 'id' | 'invoice_no' | 'grand_total'>
  sales_return_items?: SalesReturnItem[]
}
```

- [ ] **Step 2: Add `formatReturnNo` to `lib/invoice-number.ts`**

```typescript
export function formatReturnNo(counter: number): string {
  return `RET-${String(counter).padStart(6, '0')}`
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts lib/invoice-number.ts
git commit -m "feat(returns): types + formatReturnNo"
```

---

### Task 3: Server actions — actions/sales-returns.ts

**Files:**
- Create: `actions/sales-returns.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SalesReturn, SalesReturnItem, ReturnRefundMethod } from '@/types/database'
import { calculateLineGST } from '@/lib/gst'

export interface ReturnLineInput {
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  quantity_returned: number
  rate: number
  discount: number
  gst_rate: number
  customer_state: string
}

export interface CreateSalesReturnData {
  invoice_id: string
  reason: string
  refund_method: ReturnRefundMethod
  notes?: string
  items: ReturnLineInput[]
}

export async function createSalesReturn(data: CreateSalesReturnData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.items.length === 0) throw new Error('Select at least one item to return.')

  // 1. Verify invoice exists and is not cancelled
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, status, invoice_items(*)')
    .eq('id', data.invoice_id)
    .single()
  if (invErr || !invoice) throw new Error('Invoice not found')
  if (invoice.status === 'cancelled') throw new Error('Cannot return against a cancelled invoice.')

  // 2. Validate quantities — cannot exceed original quantity minus already-returned qty
  for (const item of data.items) {
    const originalItem = (invoice.invoice_items as Array<{ id: string; quantity: number }>)
      .find(i => i.id === item.invoice_item_id)
    if (!originalItem) throw new Error(`Invoice item ${item.invoice_item_id} not found on invoice.`)
    if (item.quantity_returned <= 0) throw new Error('Return quantity must be greater than 0.')
    if (item.quantity_returned > originalItem.quantity) {
      throw new Error(`Cannot return more than ${originalItem.quantity} units of "${item.product_name}".`)
    }

    // Check already-returned qty for this invoice item
    const { data: priorReturns } = await supabase
      .from('sales_return_items')
      .select('quantity_returned')
      .eq('invoice_item_id', item.invoice_item_id)
    const alreadyReturned = (priorReturns ?? []).reduce((s, r) => s + r.quantity_returned, 0)
    const maxReturnable = originalItem.quantity - alreadyReturned
    if (item.quantity_returned > maxReturnable) {
      throw new Error(`Only ${maxReturnable} units of "${item.product_name}" can still be returned (${alreadyReturned} already returned).`)
    }
  }

  // 3. Get return number
  const { data: returnNoRow, error: seqErr } = await supabase.rpc('next_return_no')
  if (seqErr || !returnNoRow) throw new Error('Failed to generate return number.')

  // 4. Calculate GST per line item
  const returnItems = data.items.map(item => {
    const gst = calculateLineGST(
      { rate: item.rate, quantity: item.quantity_returned, discount: item.discount * item.quantity_returned / (item.quantity_returned || 1), gst_rate: item.gst_rate },
      item.customer_state
    )
    return { ...item, ...gst }
  })
  const total_refund = returnItems.reduce((s, i) => s + i.total, 0)

  // 5. Insert return header
  const { data: ret, error: retErr } = await supabase
    .from('sales_returns')
    .insert({
      return_no: String(returnNoRow),
      invoice_id: data.invoice_id,
      reason: data.reason,
      refund_method: data.refund_method,
      total_refund,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (retErr) throw new Error(retErr.message)

  // 6. Insert return items
  const { error: itemsErr } = await supabase.from('sales_return_items').insert(
    returnItems.map(item => ({
      return_id: ret.id,
      invoice_item_id: item.invoice_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      serial_number: item.serial_number,
      quantity_returned: item.quantity_returned,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
      taxable_amount: item.taxable_amount,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      total: item.total,
    }))
  )
  if (itemsErr) throw new Error(itemsErr.message)

  // 7. Restore stock for each product
  for (const item of returnItems) {
    if (!item.product_id) continue
    const { data: product } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .single()
    if (product) {
      await supabase
        .from('products')
        .update({ current_stock: product.current_stock + item.quantity_returned })
        .eq('id', item.product_id)
    }
    // Restore serial if applicable
    if (item.serial_number) {
      await supabase
        .from('product_serials')
        .update({ status: 'returned' })
        .eq('serial_number', item.serial_number)
        .eq('product_id', item.product_id)
    }
  }

  revalidatePath('/returns')
  revalidatePath(`/invoices/${data.invoice_id}`)
  return ret.id
}

export async function getSalesReturns(limit = 100): Promise<(SalesReturn & {
  invoices: { invoice_no: string; grand_total: number } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales_returns')
    .select('*, invoices(invoice_no, grand_total)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getSalesReturn(id: string): Promise<(SalesReturn & {
  invoices: { id: string; invoice_no: string; grand_total: number; customers: { name: string; state: string } | null } | null
  sales_return_items: SalesReturnItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales_returns')
    .select('*, invoices(id, invoice_no, grand_total, customers(name, state)), sales_return_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function getReturnableItems(invoiceId: string): Promise<Array<{
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  original_qty: number
  already_returned: number
  returnable_qty: number
  rate: number
  discount: number
  gst_rate: number
}>> {
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('invoice_items(*)')
    .eq('id', invoiceId)
    .single()
  if (error || !invoice) throw new Error('Invoice not found')

  const items = (invoice.invoice_items as Array<{
    id: string; product_id: string | null; product_name: string; sku: string | null
    serial_number: string | null; quantity: number; rate: number; discount: number; gst_rate: number
  }>)

  const result = []
  for (const item of items) {
    const { data: priorReturns } = await supabase
      .from('sales_return_items')
      .select('quantity_returned')
      .eq('invoice_item_id', item.id)
    const alreadyReturned = (priorReturns ?? []).reduce((s, r) => s + r.quantity_returned, 0)
    const returnable_qty = item.quantity - alreadyReturned
    result.push({
      invoice_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      serial_number: item.serial_number,
      original_qty: item.quantity,
      already_returned: alreadyReturned,
      returnable_qty,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
    })
  }
  return result.filter(i => i.returnable_qty > 0)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add actions/sales-returns.ts
git commit -m "feat(returns): createSalesReturn + getReturnableItems server actions"
```

---

### Task 4: ReturnForm component

**Files:**
- Create: `components/sales-returns/ReturnForm.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSalesReturn, type ReturnLineInput } from '@/actions/sales-returns'
import type { ReturnRefundMethod } from '@/types/database'

interface ReturnableItem {
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  original_qty: number
  already_returned: number
  returnable_qty: number
  rate: number
  discount: number
  gst_rate: number
}

interface Props {
  invoiceId: string
  invoiceNo: string
  customerState: string
  items: ReturnableItem[]
}

const REFUND_METHODS: { value: ReturnRefundMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'no_refund', label: 'No Refund / Exchange' },
]

export function ReturnForm({ invoiceId, invoiceNo, customerState, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('cash')
  const [notes, setNotes] = useState('')

  function toggleItem(id: string, maxQty: number) {
    setSelected(prev => {
      if (prev[id] !== undefined) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
    void maxQty
  }

  function setQty(id: string, qty: number) {
    const item = items.find(i => i.invoice_item_id === id)
    if (!item) return
    const clamped = Math.min(Math.max(1, qty), item.returnable_qty)
    setSelected(prev => ({ ...prev, [id]: clamped }))
  }

  const selectedItems = items.filter(i => selected[i.invoice_item_id] !== undefined)
  const totalRefund = selectedItems.reduce((s, i) => {
    const qty = selected[i.invoice_item_id] ?? 0
    const taxable = (i.rate * qty) - (i.discount / i.original_qty * qty)
    const gst = taxable * (i.gst_rate / 100)
    return s + taxable + gst
  }, 0)

  function handleSubmit() {
    if (selectedItems.length === 0) { toast.error('Select at least one item to return.'); return }
    if (!reason.trim()) { toast.error('Enter a reason for the return.'); return }

    const returnItems: ReturnLineInput[] = selectedItems.map(i => ({
      invoice_item_id: i.invoice_item_id,
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      serial_number: i.serial_number,
      quantity_returned: selected[i.invoice_item_id] ?? 1,
      rate: i.rate,
      discount: i.discount,
      gst_rate: i.gst_rate,
      customer_state: customerState,
    }))

    startTransition(async () => {
      try {
        const returnId = await createSalesReturn({
          invoice_id: invoiceId,
          reason,
          refund_method: refundMethod,
          notes: notes.trim() || undefined,
          items: returnItems,
        })
        toast.success('Return processed successfully.')
        router.push(`/returns/${returnId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Return failed.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Select Items to Return</h3>
        <div className="space-y-3">
          {items.map(item => {
            const isSelected = selected[item.invoice_item_id] !== undefined
            return (
              <div
                key={item.invoice_item_id}
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => toggleItem(item.invoice_item_id, item.returnable_qty)}
              >
                <input type="checkbox" readOnly checked={isSelected} className="size-4 accent-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-slate-500">
                    {item.sku} {item.serial_number && `· S/N: ${item.serial_number}`}
                    · Max returnable: {item.returnable_qty}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">₹{item.rate.toFixed(2)}</p>
                </div>
                {isSelected && (
                  <div onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={1}
                      max={item.returnable_qty}
                      value={selected[item.invoice_item_id]}
                      onChange={e => setQty(item.invoice_item_id, parseInt(e.target.value) || 1)}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Reason for Return *</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Defective product, Wrong item, Customer changed mind"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Refund Method</label>
          <div className="flex flex-wrap gap-2">
            {REFUND_METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setRefundMethod(m.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  refundMethod === m.value
                    ? 'bg-[#111827] text-white border-[#111827]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 resize-none"
          />
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <strong>{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected.</strong>
          {' '}Estimated refund: <strong>₹{totalRefund.toFixed(2)}</strong>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || selectedItems.length === 0}
          className="px-6 py-2.5 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
        >
          {isPending ? 'Processing…' : 'Process Return'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/sales-returns/ReturnForm.tsx
git commit -m "feat(returns): ReturnForm client component"
```

---

### Task 5: Pages — return flow + list + detail

**Files:**
- Create: `app/(dashboard)/invoices/[id]/return/page.tsx`
- Create: `app/(dashboard)/returns/page.tsx`
- Create: `app/(dashboard)/returns/[id]/page.tsx`

- [ ] **Step 1: Create `/invoices/[id]/return/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/actions/invoices'
import { getReturnableItems } from '@/actions/sales-returns'
import { ReturnForm } from '@/components/sales-returns/ReturnForm'

export default async function InvoiceReturnPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()
  if (invoice.status === 'cancelled') {
    return (
      <div className="max-w-2xl">
        <p className="text-red-600 font-medium">Cannot process return — invoice is cancelled.</p>
        <Link href={`/invoices/${params.id}`} className="text-sm text-blue-600 hover:underline mt-2 inline-block">← Back to Invoice</Link>
      </div>
    )
  }

  const returnableItems = await getReturnableItems(params.id)

  if (returnableItems.length === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-[#111827]">Process Return</h1>
        <p className="text-slate-600">All items on invoice <strong>{invoice.invoice_no}</strong> have already been returned.</p>
        <Link href={`/invoices/${params.id}`} className="text-sm text-blue-600 hover:underline">← Back to Invoice</Link>
      </div>
    )
  }

  const customerState = invoice.customers?.state ?? 'Telangana'

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/invoices/${params.id}`} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
          ← {invoice.invoice_no}
        </Link>
        <h1 className="text-2xl font-bold text-[#111827]">Process Return</h1>
        <p className="text-slate-500 text-sm mt-1">Select items to return from invoice {invoice.invoice_no}</p>
      </div>
      <ReturnForm
        invoiceId={params.id}
        invoiceNo={invoice.invoice_no}
        customerState={customerState}
        items={returnableItems}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `/returns/page.tsx`**

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { getSalesReturns } from '@/actions/sales-returns'

const REFUND_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card',
  bank_transfer: 'Bank Transfer', store_credit: 'Store Credit', no_refund: 'No Refund',
}

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function ReturnsPage() {
  const returns = await getSalesReturns()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Sales Returns</h1>
        <p className="text-slate-500 text-sm mt-1">{returns.length} return{returns.length !== 1 ? 's' : ''} processed</p>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 font-medium">No returns yet.</p>
          <p className="text-slate-400 text-sm mt-1">Process a return from an invoice detail page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111827]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Return No</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Reason</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Refund Method</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Refund</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(ret => (
                <tr key={ret.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{ret.return_no}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                    {ret.invoices?.invoice_no ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 hidden sm:table-cell max-w-xs truncate">{ret.reason}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {REFUND_LABELS[ret.refund_method] ?? ret.refund_method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                    ₹{formatINR(ret.total_refund)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                    {format(new Date(ret.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/returns/${ret.id}`} className="text-xs text-blue-600 hover:underline font-medium">
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

- [ ] **Step 3: Create `/returns/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getSalesReturn } from '@/actions/sales-returns'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const REFUND_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card',
  bank_transfer: 'Bank Transfer', store_credit: 'Store Credit', no_refund: 'No Refund / Exchange',
}

export default async function ReturnDetailPage({ params }: { params: { id: string } }) {
  const ret = await getSalesReturn(params.id)
  if (!ret) notFound()

  const items = ret.sales_return_items ?? []
  const customerName = ret.invoices?.customers?.name ?? 'Walk-in Customer'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/returns" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
            ← Returns
          </Link>
          <h1 className="text-2xl font-bold text-[#111827]">{ret.return_no}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(ret.created_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>
        <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          {REFUND_LABELS[ret.refund_method] ?? ret.refund_method}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice</span>
          <Link href={`/invoices/${ret.invoices?.id}`} className="font-mono font-medium text-blue-600 hover:underline">
            {ret.invoices?.invoice_no}
          </Link>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Customer</span>
          <span className="font-medium text-slate-900">{customerName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Reason</span>
          <span className="font-medium text-slate-900 text-right max-w-xs">{ret.reason}</span>
        </div>
        {ret.notes && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Notes</span>
            <span className="text-slate-700 text-right max-w-xs">{ret.notes}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Rate</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  {item.serial_number && <p className="text-xs text-slate-400">S/N: {item.serial_number}</p>}
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{item.quantity_returned}</td>
                <td className="px-4 py-3 text-right text-slate-700">₹{formatINR(item.rate)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{formatINR(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Total Refund</td>
              <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">₹{formatINR(ret.total_refund)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/invoices/[id]/return/" "app/(dashboard)/returns/"
git commit -m "feat(returns): return pages — invoice/[id]/return, /returns list, /returns/[id] detail"
```

---

### Task 6: Invoice detail — add Return button + sidebar nav

**Files:**
- Modify: `app/(dashboard)/invoices/[id]/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Read `app/(dashboard)/invoices/[id]/page.tsx`**

Find the header actions area (near where `InvoiceShareButtons` is rendered).

- [ ] **Step 2: Add Return button**

In the header `div` alongside the `InvoiceShareButtons` component, add a Return link:

```tsx
import Link from 'next/link'
// ... existing imports ...

// In the JSX, after InvoiceShareButtons:
{invoice.status !== 'cancelled' && (
  <Link
    href={`/invoices/${invoice.id}/return`}
    className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
  >
    ↩ Return
  </Link>
)}
```

- [ ] **Step 3: Add Returns to sidebar in `components/layout/Sidebar.tsx`**

Read the file. Find the `navItems` array. After `{ label: 'Stock Adjustments', href: '/stock-adjustments', icon: SlidersHorizontal }`, add:

```typescript
{ label: 'Returns', href: '/returns', icon: RotateCcw },
```

Import `RotateCcw` from lucide-react at the top.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/invoices/[id]/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat(returns): Return button on invoice detail + sidebar nav link"
```

---

### Verification Checklist

- [ ] Create invoice for customer with 2 items (one serial-required)
- [ ] Open invoice detail → "↩ Return" button visible
- [ ] Click Return → see both items listed with max returnable qty
- [ ] Select 1 item, pick reason, pick refund method → submit
- [ ] Redirected to return detail page showing RET-000001
- [ ] Check product stock restored on Products page
- [ ] Check serial status changed to 'returned' in product serials
- [ ] Try to return same item again → only remaining qty shown (0 if fully returned)
- [ ] Try return on cancelled invoice → blocked with clear message
- [ ] /returns page shows list entry
