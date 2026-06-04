# Stock Adjustment Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stock adjustment module that lets staff manually correct stock levels (damages, returns, write-offs, manual corrections) with full audit trail.

**Architecture:** New `stock_adjustments` DB table stores each adjustment with reason + delta. A server action applies the delta to `products.current_stock` atomically. New dashboard page lists history and provides a form to create adjustments.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind, react-hook-form, zod

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `types/database.ts` | Modify | Add `StockAdjustment` interface + `StockAdjustmentType` union |
| `actions/stock-adjustments.ts` | Create | `createStockAdjustment`, `getStockAdjustments` server actions |
| `app/(dashboard)/stock-adjustments/page.tsx` | Create | List page with history table + "New Adjustment" button |
| `app/(dashboard)/stock-adjustments/new/page.tsx` | Create | Form page |
| `components/stock-adjustments/StockAdjustmentForm.tsx` | Create | Client form component |
| `app/(dashboard)/layout.tsx` | Modify | Add "Stock Adjustments" nav link |

---

### Task 1: Database — `stock_adjustments` table + type

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Apply Supabase migration via MCP**

Use Supabase MCP tool `apply_migration` with:
```sql
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('damage','return','correction','write_off','found')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_created ON stock_adjustments(created_at DESC);

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

- [ ] **Step 2: Add type to `types/database.ts`**

Open `types/database.ts`. After line `export type StockChangeType = ...` add:

```typescript
export type StockAdjustmentType = 'damage' | 'return' | 'correction' | 'write_off' | 'found'
```

After `StockIn` interface, add:

```typescript
export interface StockAdjustment {
  id: string
  product_id: string
  adjustment_type: StockAdjustmentType
  quantity: number
  notes: string | null
  created_by: string | null
  created_at: string
  products?: Pick<Product, 'id' | 'name' | 'sku' | 'current_stock'>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat(stock): add StockAdjustment type + DB migration"
```

---

### Task 2: Server actions — `createStockAdjustment` + `getStockAdjustments`

**Files:**
- Create: `actions/stock-adjustments.ts`

- [ ] **Step 1: Create `actions/stock-adjustments.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StockAdjustment, StockAdjustmentType } from '@/types/database'

export interface CreateAdjustmentData {
  product_id: string
  adjustment_type: StockAdjustmentType
  quantity: number
  notes: string | null
}

export async function createStockAdjustment(data: CreateAdjustmentData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.quantity === 0) throw new Error('Quantity cannot be zero')

  // Fetch current stock first
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, current_stock, name')
    .eq('id', data.product_id)
    .single()
  if (pErr || !product) throw new Error('Product not found')

  const newStock = product.current_stock + data.quantity
  if (newStock < 0) throw new Error(`Cannot reduce stock below 0. Current: ${product.current_stock}`)

  // Insert adjustment record
  const { error: adjErr } = await supabase.from('stock_adjustments').insert({
    product_id: data.product_id,
    adjustment_type: data.adjustment_type,
    quantity: data.quantity,
    notes: data.notes,
    created_by: user.id,
  })
  if (adjErr) throw new Error(adjErr.message)

  // Update product stock
  const { error: stockErr } = await supabase
    .from('products')
    .update({ current_stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', data.product_id)
  if (stockErr) throw new Error(stockErr.message)

  revalidatePath('/stock-adjustments')
  revalidatePath('/products')
}

export async function getStockAdjustments(limit = 200): Promise<(StockAdjustment & {
  products: { id: string; name: string; sku: string; current_stock: number } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*, products(id, name, sku, current_stock)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add actions/stock-adjustments.ts
git commit -m "feat(stock): createStockAdjustment + getStockAdjustments server actions"
```

---

### Task 3: StockAdjustmentForm client component

**Files:**
- Create: `components/stock-adjustments/StockAdjustmentForm.tsx`

- [ ] **Step 1: Create form component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStockAdjustment } from '@/actions/stock-adjustments'
import type { Product } from '@/types/database'
import type { StockAdjustmentType } from '@/types/database'

const ADJUSTMENT_TYPES: { value: StockAdjustmentType; label: string; sign: '+' | '-'; color: string }[] = [
  { value: 'found',       label: 'Found / Received',   sign: '+', color: 'text-emerald-600' },
  { value: 'return',      label: 'Customer Return',     sign: '+', color: 'text-blue-600'    },
  { value: 'damage',      label: 'Damage / Loss',       sign: '-', color: 'text-red-600'     },
  { value: 'write_off',   label: 'Write-Off',           sign: '-', color: 'text-red-600'     },
  { value: 'correction',  label: 'Manual Correction',   sign: '+', color: 'text-amber-600'   },
]

interface Props {
  products: Product[]
}

export function StockAdjustmentForm({ products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [productId, setProductId] = useState('')
  const [adjType, setAdjType] = useState<StockAdjustmentType>('correction')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  const selectedProduct = products.find(p => p.id === productId)
  const typeConfig = ADJUSTMENT_TYPES.find(t => t.value === adjType)!
  const actualQty = typeConfig.sign === '-' ? -Math.abs(qty) : Math.abs(qty)
  const projectedStock = selectedProduct ? selectedProduct.current_stock + actualQty : null

  const filteredProducts = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 10)
    : products.slice(0, 10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { toast.error('Select a product'); return }
    if (qty <= 0) { toast.error('Quantity must be > 0'); return }

    startTransition(async () => {
      try {
        await createStockAdjustment({
          product_id: productId,
          adjustment_type: adjType,
          quantity: actualQty,
          notes: notes.trim() || null,
        })
        toast.success('Stock adjusted successfully')
        router.push('/stock-adjustments')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save adjustment')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Product search */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Product *</label>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setProductId('') }}
          placeholder="Search product by name or SKU…"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
        {search && !productId && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
            {filteredProducts.length === 0
              ? <p className="px-4 py-3 text-sm text-slate-400">No products found</p>
              : filteredProducts.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setProductId(p.id); setSearch(p.name) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-slate-500 text-xs">{p.sku} · Stock: {p.current_stock}</span>
                  </button>
                ))
            }
          </div>
        )}
        {selectedProduct && (
          <p className="text-xs text-slate-500">Current stock: <strong>{selectedProduct.current_stock}</strong> units</p>
        )}
      </div>

      {/* Adjustment type */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Adjustment Type *</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ADJUSTMENT_TYPES.map(t => (
            <button key={t.value} type="button"
              onClick={() => setAdjType(t.value)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition-all ${
                adjType === t.value
                  ? 'border-[#111827] bg-[#111827] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={adjType === t.value ? 'text-white' : t.color}>{t.sign} </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Quantity *</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
        {projectedStock !== null && (
          <p className={`text-xs font-medium ${projectedStock < 0 ? 'text-red-600' : 'text-slate-500'}`}>
            Projected stock after adjustment: <strong>{projectedStock}</strong> units
            {projectedStock < 0 && ' — cannot go below 0'}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Notes <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Reason for adjustment, reference number, etc."
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isPending || !productId || (projectedStock !== null && projectedStock < 0)}
          className="flex-1 rounded-xl bg-[#111827] py-2.5 text-sm font-semibold text-white hover:bg-[#1F2937] disabled:opacity-50 transition-colors">
          {isPending ? 'Saving…' : 'Save Adjustment'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/stock-adjustments/StockAdjustmentForm.tsx
git commit -m "feat(stock): StockAdjustmentForm component"
```

---

### Task 4: Pages — list + new

**Files:**
- Create: `app/(dashboard)/stock-adjustments/page.tsx`
- Create: `app/(dashboard)/stock-adjustments/new/page.tsx`

- [ ] **Step 1: Create list page `app/(dashboard)/stock-adjustments/page.tsx`**

```typescript
import Link from 'next/link'
import { getStockAdjustments } from '@/actions/stock-adjustments'
import { getProducts } from '@/actions/products'
import { format } from 'date-fns'
import { PlusIcon, PackageIcon } from 'lucide-react'
import type { StockAdjustmentType } from '@/types/database'

const TYPE_LABELS: Record<StockAdjustmentType, string> = {
  found:      'Found / Received',
  return:     'Customer Return',
  damage:     'Damage / Loss',
  write_off:  'Write-Off',
  correction: 'Manual Correction',
}

const TYPE_CLASSES: Record<StockAdjustmentType, string> = {
  found:      'bg-emerald-100 text-emerald-700',
  return:     'bg-blue-100 text-blue-700',
  damage:     'bg-red-100 text-red-700',
  write_off:  'bg-red-100 text-red-700',
  correction: 'bg-amber-100 text-amber-700',
}

export default async function StockAdjustmentsPage() {
  const adjustments = await getStockAdjustments()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Stock Adjustments
          </h1>
          <p className="text-slate-500 text-sm mt-1">{adjustments.length} total adjustment{adjustments.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/stock-adjustments/new"
          className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
          <PlusIcon className="size-4" />
          New Adjustment
        </Link>
      </div>

      {adjustments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PackageIcon className="size-8 text-slate-400" />
          </div>
          <p className="font-semibold text-[#111827]">No adjustments yet</p>
          <p className="text-sm text-slate-500 mt-1">Record stock corrections, damages, or returns here</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj, i) => (
                  <tr key={adj.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create new adjustment page `app/(dashboard)/stock-adjustments/new/page.tsx`**

```typescript
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { getProducts } from '@/actions/products'
import { StockAdjustmentForm } from '@/components/stock-adjustments/StockAdjustmentForm'

export default async function NewStockAdjustmentPage() {
  const products = await getProducts({ status: 'active' })

  return (
    <div className="space-y-5">
      <div>
        <Link href="/stock-adjustments" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="size-3.5" /> Stock Adjustments
        </Link>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          New Stock Adjustment
        </h1>
        <p className="text-slate-500 text-sm mt-1">Correct stock levels for damages, returns, or manual corrections</p>
      </div>
      <StockAdjustmentForm products={products} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/stock-adjustments/
git commit -m "feat(stock): stock adjustments list + new pages"
```

---

### Task 5: Add nav link to sidebar

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Read `app/(dashboard)/layout.tsx`** to find nav items array/section.

- [ ] **Step 2: Add stock-adjustments nav entry**

Find the nav section (look for `/stock-in` or similar links). Add after stock-in entry:

```typescript
{ href: '/stock-adjustments', label: 'Stock Adjustments', icon: SlidersHorizontalIcon },
```

Add import at top: `import { SlidersHorizontalIcon } from 'lucide-react'`

- [ ] **Step 3: Verify TypeScript + check nav renders correctly**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat(stock): add Stock Adjustments to sidebar nav"
```

---

### Verification Checklist

- [ ] Navigate to `/stock-adjustments` — list page loads
- [ ] Click "New Adjustment" — form loads with product search
- [ ] Search product, select it, pick "Damage / Loss", qty=2, save
- [ ] Confirm product `current_stock` decreased by 2 in Products list
- [ ] Try reducing stock below 0 — should show error toast
- [ ] Verify adjustment appears in history with correct type badge + qty
