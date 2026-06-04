# Purchase Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to create purchase orders to suppliers, track their status (draft → sent → received → cancelled), and "receive" a PO which automatically creates a supplier invoice + stock_in records.

**Architecture:** New `purchase_orders` + `purchase_order_items` tables. PO number format `PO-000001` via Supabase sequence. Status flow: `draft` → `sent` → `received` | `cancelled`. On "Receive PO", a server action creates one `supplier_invoices` record and one `stock_in` record per line item, then marks PO as `received`. Sidebar nav link added.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind

**Security:** All mutations require auth. Cannot receive an already-received or cancelled PO. Cannot delete received PO. RLS on both tables.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| Supabase migration | Apply | `purchase_orders` + `purchase_order_items` + `next_po_no()` + RLS |
| `types/database.ts` | Modify | Add `PurchaseOrder`, `PurchaseOrderItem`, `POStatus` |
| `lib/invoice-number.ts` | Modify | Add `formatPONo` |
| `actions/purchase-orders.ts` | Create | All PO server actions |
| `components/purchase-orders/POForm.tsx` | Create | Create PO form |
| `app/(dashboard)/purchase-orders/page.tsx` | Create | PO list |
| `app/(dashboard)/purchase-orders/new/page.tsx` | Create | New PO page |
| `app/(dashboard)/purchase-orders/[id]/page.tsx` | Create | PO detail + receive action |
| `components/layout/Sidebar.tsx` | Modify | Add Purchase Orders nav link |

---

### Task 1: DB migration

- [ ] **Step 1: Apply Supabase migration via MCP**

Migration name: `purchase_orders_tables`

```sql
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START 1;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  expected_date DATE,
  notes TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED
);

CREATE OR REPLACE FUNCTION next_po_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq_val BIGINT;
BEGIN
  SELECT nextval('purchase_order_seq') INTO seq_val;
  RETURN 'PO-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_po_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_po_timestamp();

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_purchase_orders" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_purchase_order_items" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verify**

Run: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('purchase_orders','purchase_order_items');`
Expected: 2 rows.

---

### Task 2: Types + formatPONo

**Files:**
- Modify: `types/database.ts`
- Modify: `lib/invoice-number.ts`

- [ ] **Step 1: Add types to `types/database.ts`**

Add after `export type ReturnRefundMethod`:
```typescript
export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'
```

Add after `SalesReturn` interface:
```typescript
export interface PurchaseOrderItem {
  id: string
  po_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
  total_cost: number
}

export interface PurchaseOrder {
  id: string
  po_no: string
  supplier_id: string | null
  supplier_name: string | null
  status: POStatus
  expected_date: string | null
  notes: string | null
  total_amount: number
  created_by: string | null
  created_at: string
  updated_at: string
  suppliers?: Pick<Supplier, 'id' | 'name' | 'phone' | 'email'>
  purchase_order_items?: PurchaseOrderItem[]
}
```

- [ ] **Step 2: Add `formatPONo` to `lib/invoice-number.ts`**

```typescript
export function formatPONo(counter: number): string {
  return `PO-${String(counter).padStart(6, '0')}`
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add types/database.ts lib/invoice-number.ts
git commit -m "feat(po): PurchaseOrder types + formatPONo"
```

---

### Task 3: Server actions — actions/purchase-orders.ts

**Files:**
- Create: `actions/purchase-orders.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PurchaseOrder, POStatus } from '@/types/database'

export interface POLineInput {
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
}

export interface CreatePOData {
  supplier_id: string | null
  supplier_name: string
  expected_date?: string
  notes?: string
  items: POLineInput[]
}

export async function createPurchaseOrder(data: CreatePOData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.items.length === 0) throw new Error('Add at least one item to the PO.')
  if (!data.supplier_name.trim()) throw new Error('Supplier name is required.')

  const { data: poNoRow, error: seqErr } = await supabase.rpc('next_po_no')
  if (seqErr || !poNoRow) throw new Error('Failed to generate PO number.')

  const total_amount = data.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0)

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      po_no: String(poNoRow),
      supplier_id: data.supplier_id,
      supplier_name: data.supplier_name,
      status: 'draft',
      expected_date: data.expected_date ?? null,
      notes: data.notes ?? null,
      total_amount,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (poErr) throw new Error(poErr.message)

  const { error: itemsErr } = await supabase.from('purchase_order_items').insert(
    data.items.map(item => ({
      po_id: po.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
    }))
  )
  if (itemsErr) throw new Error(itemsErr.message)

  revalidatePath('/purchase-orders')
  return po.id
}

export async function getPurchaseOrders(): Promise<(PurchaseOrder & {
  suppliers: { name: string } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getPurchaseOrder(id: string): Promise<(PurchaseOrder & {
  suppliers: { id: string; name: string; phone: string | null; email: string | null } | null
  purchase_order_items: Array<{ id: string; product_id: string | null; product_name: string; sku: string | null; quantity_ordered: number; unit_cost: number; total_cost: number }>
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(id, name, phone, email), purchase_order_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function updatePOStatus(id: string, status: POStatus): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single()
  if (!po) throw new Error('PO not found')
  if (po.status === 'received') throw new Error('Cannot change status of a received PO.')
  if (po.status === 'cancelled' && status !== 'draft') throw new Error('Cannot reactivate a cancelled PO.')

  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/purchase-orders')
  revalidatePath(`/purchase-orders/${id}`)
}

export async function receivePurchaseOrder(id: string, purchase_invoice_no: string, purchase_date: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', id)
    .single()
  if (poErr || !po) throw new Error('PO not found')
  if (po.status === 'received') throw new Error('PO already received.')
  if (po.status === 'cancelled') throw new Error('Cannot receive a cancelled PO.')

  const items = (po.purchase_order_items as Array<{
    product_id: string | null; product_name: string; sku: string | null; quantity_ordered: number; unit_cost: number
  }>)

  // Create supplier invoice
  const { data: supplierInv, error: siErr } = await supabase
    .from('supplier_invoices')
    .insert({
      purchase_invoice_no,
      supplier_name: po.supplier_name,
      supplier_gstin: null,
      purchase_date,
      total_amount: po.total_amount,
      payment_status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (siErr) throw new Error(siErr.message)

  // Create stock_in records per item
  for (const item of items) {
    if (!item.product_id) continue
    const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single()
    if (!product) continue

    await supabase.from('stock_in').insert({
      product_id: item.product_id,
      quantity: item.quantity_ordered,
      cost_price: item.unit_cost,
      supplier_name: po.supplier_name,
      purchase_invoice_no,
      purchase_date,
      supplier_invoice_id: supplierInv.id,
      created_by: user.id,
    })

    // Update product stock
    await supabase
      .from('products')
      .update({ current_stock: product.current_stock + item.quantity_ordered })
      .eq('id', item.product_id)
  }

  // Mark PO as received
  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'received' })
    .eq('id', id)
  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/purchase-orders')
  revalidatePath(`/purchase-orders/${id}`)
  revalidatePath('/stock-in')
  revalidatePath('/products')
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/purchase-orders.ts
git commit -m "feat(po): purchase order server actions"
```

---

### Task 4: POForm component

**Files:**
- Create: `components/purchase-orders/POForm.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { createPurchaseOrder, type POLineInput } from '@/actions/purchase-orders'
import type { Product, Supplier } from '@/types/database'

interface Props {
  products: Pick<Product, 'id' | 'name' | 'sku' | 'cost_price'>[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

interface LineItem {
  _id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
}

function newLine(): LineItem {
  return { _id: crypto.randomUUID(), product_id: null, product_name: '', sku: null, quantity_ordered: 1, unit_cost: 0 }
}

export function POForm({ products, suppliers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [supplierId, setSupplierId] = useState<string>('')
  const [supplierName, setSupplierName] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([newLine()])

  function selectSupplier(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => s.id === id)
    if (sup) setSupplierName(sup.name)
  }

  function selectProduct(lineId: string, productId: string) {
    const product = products.find(p => p.id === productId)
    setLines(prev => prev.map(l =>
      l._id === lineId
        ? { ...l, product_id: productId, product_name: product?.name ?? '', sku: product?.sku ?? null, unit_cost: product?.cost_price ?? 0 }
        : l
    ))
  }

  function updateLine(lineId: string, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => l._id === lineId ? { ...l, [field]: value } : l))
  }

  function removeLine(lineId: string) {
    if (lines.length === 1) return
    setLines(prev => prev.filter(l => l._id !== lineId))
  }

  const totalAmount = lines.reduce((s, l) => s + l.quantity_ordered * l.unit_cost, 0)

  function handleSubmit() {
    if (!supplierName.trim()) { toast.error('Enter supplier name.'); return }
    const validLines = lines.filter(l => l.product_name.trim() && l.quantity_ordered > 0)
    if (validLines.length === 0) { toast.error('Add at least one item.'); return }

    const items: POLineInput[] = validLines.map(l => ({
      product_id: l.product_id,
      product_name: l.product_name,
      sku: l.sku,
      quantity_ordered: l.quantity_ordered,
      unit_cost: l.unit_cost,
    }))

    startTransition(async () => {
      try {
        const poId = await createPurchaseOrder({
          supplier_id: supplierId || null,
          supplier_name: supplierName,
          expected_date: expectedDate || undefined,
          notes: notes || undefined,
          items,
        })
        toast.success('Purchase Order created.')
        router.push(`/purchase-orders/${poId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create PO.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Supplier */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Supplier</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Select Supplier</label>
            <select
              value={supplierId}
              onChange={e => selectSupplier(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            >
              <option value="">— Select or type below —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Supplier Name *</label>
            <input
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Supplier name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDate}
              onChange={e => setExpectedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Items</h3>
        {lines.map((line, i) => (
          <div key={line._id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-5">
              <select
                value={line.product_id ?? ''}
                onChange={e => selectProduct(line._id, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
              >
                <option value="">Select product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <input
                type="text"
                value={line.product_name}
                onChange={e => updateLine(line._id, 'product_name', e.target.value)}
                placeholder="Name"
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={1}
                value={line.quantity_ordered}
                onChange={e => updateLine(line._id, 'quantity_ordered', parseInt(e.target.value) || 1)}
                placeholder="Qty"
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 text-center"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={0}
                step={0.01}
                value={line.unit_cost}
                onChange={e => updateLine(line._id, 'unit_cost', parseFloat(e.target.value) || 0)}
                placeholder="Cost"
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 text-right"
              />
            </div>
            <div className="col-span-1 text-right">
              {lines.length > 1 && (
                <button onClick={() => removeLine(line._id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2Icon className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines(prev => [...prev, newLine()])}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
        >
          <PlusIcon className="size-4" /> Add Item
        </button>
      </div>

      {/* Total + Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-lg font-bold text-slate-900">
          Total: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
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
            disabled={isPending}
            className="px-6 py-2.5 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
          >
            {isPending ? 'Creating…' : 'Create Purchase Order'}
          </button>
        </div>
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
git add components/purchase-orders/POForm.tsx
git commit -m "feat(po): POForm client component"
```

---

### Task 5: Pages — list, new, detail

**Files:**
- Create: `app/(dashboard)/purchase-orders/page.tsx`
- Create: `app/(dashboard)/purchase-orders/new/page.tsx`
- Create: `app/(dashboard)/purchase-orders/[id]/page.tsx`

- [ ] **Step 1: Create `/purchase-orders/page.tsx`**

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { getPurchaseOrders } from '@/actions/purchase-orders'
import type { POStatus } from '@/types/database'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const STATUS_STYLE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default async function PurchaseOrdersPage() {
  const orders = await getPurchaseOrders()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/purchase-orders/new"
          className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
        >
          + New PO
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 font-medium">No purchase orders yet.</p>
          <Link href="/purchase-orders/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Create your first purchase order →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111827]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">PO No</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Supplier</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Created</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{po.po_no}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{po.supplier_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[po.status]}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">₹{formatINR(po.total_amount)}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                    {format(new Date(po.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/purchase-orders/${po.id}`} className="text-xs text-blue-600 hover:underline font-medium">
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

- [ ] **Step 2: Create `/purchase-orders/new/page.tsx`**

```tsx
import { getActiveProducts } from '@/actions/products'
import { getSuppliers } from '@/actions/suppliers'
import { POForm } from '@/components/purchase-orders/POForm'

export default async function NewPurchaseOrderPage() {
  const [products, suppliers] = await Promise.all([
    getActiveProducts(),
    getSuppliers(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">New Purchase Order</h1>
        <p className="text-slate-500 text-sm mt-1">Create a purchase order to send to a supplier.</p>
      </div>
      <POForm
        products={products.map(p => ({ id: p.id, name: p.name, sku: p.sku, cost_price: p.cost_price }))}
        suppliers={suppliers.map(s => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
```

Note: `getActiveProducts()` may be named differently. Read `actions/products.ts` to find the correct export for fetching active products. Use whatever function returns `Product[]` filtered by `status='active'`.

- [ ] **Step 3: Create `/purchase-orders/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getPurchaseOrder } from '@/actions/purchase-orders'
import { PODetailActions } from '@/components/purchase-orders/PODetailActions'
import type { POStatus } from '@/types/database'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const STATUS_STYLE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const po = await getPurchaseOrder(params.id)
  if (!po) notFound()

  const items = po.purchase_order_items ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/purchase-orders" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
            ← Purchase Orders
          </Link>
          <h1 className="text-2xl font-bold text-[#111827]">{po.po_no}</h1>
          <p className="text-slate-500 text-sm mt-1">{format(new Date(po.created_at), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_STYLE[po.status]}`}>
          {po.status}
        </span>
      </div>

      {/* Supplier Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Supplier</span>
          <span className="font-semibold text-slate-900">{po.supplier_name ?? '—'}</span>
        </div>
        {po.expected_date && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Expected Date</span>
            <span className="font-medium text-slate-900">{format(new Date(po.expected_date), 'dd MMM yyyy')}</span>
          </div>
        )}
        {po.notes && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Notes</span>
            <span className="text-slate-700">{po.notes}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Unit Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{item.quantity_ordered}</td>
                <td className="px-4 py-3 text-right text-slate-700">₹{formatINR(item.unit_cost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{formatINR(item.total_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Total</td>
              <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">₹{formatINR(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <PODetailActions po={{ id: po.id, status: po.status, po_no: po.po_no }} />
    </div>
  )
}
```

- [ ] **Step 4: Create `components/purchase-orders/PODetailActions.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePOStatus, receivePurchaseOrder } from '@/actions/purchase-orders'
import type { POStatus } from '@/types/database'

interface Props {
  po: { id: string; status: POStatus; po_no: string }
}

export function PODetailActions({ po }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])

  function handleStatusUpdate(status: POStatus) {
    startTransition(async () => {
      try {
        await updatePOStatus(po.id, status)
        toast.success(`PO marked as ${status}.`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status.')
      }
    })
  }

  function handleReceive() {
    if (!invoiceNo.trim()) { toast.error('Enter supplier invoice number.'); return }
    if (!invoiceDate) { toast.error('Enter invoice date.'); return }

    startTransition(async () => {
      try {
        await receivePurchaseOrder(po.id, invoiceNo.trim(), invoiceDate)
        toast.success('PO received! Stock updated and supplier invoice created.')
        router.refresh()
        setShowReceiveForm(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to receive PO.')
      }
    })
  }

  if (po.status === 'received') {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-medium">
        ✓ This PO has been received. Stock has been updated.
      </div>
    )
  }

  if (po.status === 'cancelled') {
    return (
      <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-600">
        This PO has been cancelled.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!showReceiveForm ? (
        <div className="flex flex-wrap gap-3">
          {po.status === 'draft' && (
            <button
              onClick={() => handleStatusUpdate('sent')}
              disabled={isPending}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
            >
              Mark as Sent
            </button>
          )}
          {(po.status === 'draft' || po.status === 'sent') && (
            <button
              onClick={() => setShowReceiveForm(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold"
            >
              Receive PO
            </button>
          )}
          <button
            onClick={() => handleStatusUpdate('cancelled')}
            disabled={isPending}
            className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold"
          >
            Cancel PO
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">Receive PO — Enter Supplier Invoice Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Supplier Invoice No *</label>
              <input
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="e.g. SINV-2024-001"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Invoice Date *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowReceiveForm(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReceive}
              disabled={isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
            >
              {isPending ? 'Receiving…' : 'Confirm Receipt & Update Stock'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/purchase-orders/" components/purchase-orders/
git commit -m "feat(po): purchase order pages — list, new, detail + receive flow"
```

---

### Task 6: Sidebar nav link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Read `components/layout/Sidebar.tsx`** to find navItems array and existing imports.

- [ ] **Step 2: Add import**

Add `ClipboardCheck` to the lucide-react import at the top of the file.

- [ ] **Step 3: Add nav item**

In `navItems` array, after `{ label: 'Suppliers', href: '/suppliers', icon: Truck }`, add:

```typescript
{ label: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardCheck },
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(po): Purchase Orders sidebar nav link"
```

---

### Key Note on getActiveProducts / getSuppliers

Before implementing Task 5 Step 2 (`/purchase-orders/new/page.tsx`):

1. Read `actions/products.ts` to find the correct function name for fetching products (might be `getProducts`, `getAllProducts`, etc.)
2. Read `actions/suppliers.ts` to find the correct function name for fetching suppliers list

Use those exact function names in the new page. Do NOT assume `getActiveProducts` or `getSuppliers` without verifying they exist.

---

### Verification Checklist

- [ ] Create new PO with supplier + 2 items → redirected to PO detail showing `PO-000001`
- [ ] PO detail shows status "draft"
- [ ] Click "Mark as Sent" → status changes to "sent"
- [ ] Click "Receive PO" → shows receive form with supplier invoice no + date
- [ ] Complete receive → toast "Stock updated and supplier invoice created"
- [ ] PO status shows "received"
- [ ] Navigate to Stock-In → new supplier invoice appears
- [ ] Navigate to Products → stock increased for each item
- [ ] Try to receive already-received PO → blocked
- [ ] Cancel a draft PO → status = cancelled, receive button gone
- [ ] PO list shows all orders with correct status badges
- [ ] Sidebar shows "Purchase Orders" nav link
