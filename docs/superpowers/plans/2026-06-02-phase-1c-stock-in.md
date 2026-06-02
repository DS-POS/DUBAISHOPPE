# Phase 1C: Stock In + Serial Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stock In module — receive inventory for a product, track serial numbers if required, auto-update `current_stock` and log to `stock_history` via a Postgres trigger.

**Architecture:** Server actions handle DB writes. A `StockInForm` client component manages product selection, dynamic serial-number inputs, and submission. A list page replaces the current stub. Stock increment + history log are handled atomically by a Postgres trigger (no dual writes in the action).

**Tech Stack:** Next.js 14 App Router, TypeScript, react-hook-form v7 + zod v4, shadcn/ui (Button, Input, Label), Supabase Postgres + RLS, sonner (toasts), date-fns v4

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/002_stock_in_trigger.sql` | Create | Postgres trigger: auto-increment stock + log stock_history on stock_in INSERT |
| `actions/stock-in.ts` | Create | Server actions: `createStockIn`, `getStockIns` |
| `components/stock-in/StockInForm.tsx` | Create | Client form: product select, qty, cost, supplier fields, dynamic serial inputs |
| `app/(dashboard)/stock-in/page.tsx` | Modify | Replace stub with paginated stock-in list |
| `app/(dashboard)/stock-in/new/page.tsx` | Create | Server component: fetch active products, render StockInForm |
| `tests/e2e/smoke.spec.ts` | Modify | Add unauthenticated redirect test for `/stock-in/new` |

---

## Context for Subagents

- Next.js 14 App Router. Server components are default; add `'use client'` only when needed.
- Server actions use `'use server'` directive at top of file.
- Supabase client: server-side uses `import { createClient } from '@/lib/supabase/server'` (async, returns client).
- All DB tables, RLS, and initial data live in `supabase/migrations/001_initial_schema.sql`.
- `types/database.ts` defines all TypeScript interfaces. Key ones for this phase:
  - `StockIn` — id, product_id, quantity, cost_price, supplier_name, supplier_gstin, purchase_invoice_no, purchase_date, notes, created_by, created_at, products?: Product
  - `ProductSerial` — id, product_id, serial_number, status, stock_in_id, invoice_id, created_at
  - `Product` — includes `serial_required: boolean`, `current_stock: number`, `cost_price: number`
- UI components live in `components/ui/` (Button, Input, Label already exist).
- Page headings use `fontFamily: 'Rubik, sans-serif'` and `text-[#0F172A]` colour — match the existing style in `app/(dashboard)/stock-in/page.tsx`.
- Toast: `import { toast } from 'sonner'`.
- Zod v4 + @hookform/resolvers v5: use `z.coerce.number()` for numeric fields. Cast resolver: `zodResolver(schema) as Resolver<FormValues>`.
- `date-fns` v4: `import { format, parseISO } from 'date-fns'`.
- Stock-in table and product_serials table already exist (created in 001_initial_schema.sql). Only the trigger is missing.

---

### Task 1: Postgres Trigger — Auto-increment Stock + Log History

**Files:**
- Create: `supabase/migrations/002_stock_in_trigger.sql`

**Note:** The user must run this SQL in the Supabase Dashboard → SQL Editor → New Query. The subagent writes the file; the user executes it.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/002_stock_in_trigger.sql` with this exact content:

```sql
-- Phase 1C: trigger to auto-increment product stock and log history on stock_in INSERT
-- Run in Supabase Dashboard → SQL Editor → New Query → Run

CREATE OR REPLACE FUNCTION fn_on_stock_in_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_new_stock INTEGER;
BEGIN
  -- Increment current_stock and capture new value
  UPDATE products
  SET current_stock = current_stock + NEW.quantity,
      updated_at    = NOW()
  WHERE id = NEW.product_id
  RETURNING current_stock INTO v_new_stock;

  -- Log to stock_history
  INSERT INTO stock_history (product_id, change_type, quantity_change, quantity_after, reference_id, created_by)
  VALUES (NEW.product_id, 'stock_in', NEW.quantity, v_new_stock, NEW.id, NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_in_insert ON stock_in;
CREATE TRIGGER trg_stock_in_insert
  AFTER INSERT ON stock_in
  FOR EACH ROW EXECUTE FUNCTION fn_on_stock_in_insert();
```

- [ ] **Step 2: Commit the file**

```bash
git add supabase/migrations/002_stock_in_trigger.sql
git commit -m "feat: Phase 1C SQL trigger - auto-increment stock on stock_in insert"
```

- [ ] **Step 3: Instruct user to run SQL**

Tell the user:
> Go to **Supabase Dashboard → SQL Editor → New Query**, paste the contents of `supabase/migrations/002_stock_in_trigger.sql`, and click **Run**. Expected: "Success. No rows returned."

---

### Task 2: Server Actions — `actions/stock-in.ts`

**Files:**
- Create: `actions/stock-in.ts`

- [ ] **Step 1: Verify TypeScript baseline**

```bash
npx tsc --noEmit
```
Expected: 0 errors before any changes.

- [ ] **Step 2: Write `actions/stock-in.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { StockIn } from '@/types/database'

export interface StockInFormData {
  product_id: string
  quantity: number
  cost_price: number
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date: string
  notes?: string
  serial_numbers?: string[]
}

export async function getStockIns(params?: {
  productId?: string
  limit?: number
}): Promise<StockIn[]> {
  const supabase = await createClient()

  let query = supabase
    .from('stock_in')
    .select('*, products(id, name, sku)')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 100)

  if (params?.productId) {
    query = query.eq('product_id', params.productId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as StockIn[]
}

export async function createStockIn(formData: StockInFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: stockInRow, error: stockInError } = await supabase
    .from('stock_in')
    .insert({
      product_id: formData.product_id,
      quantity: formData.quantity,
      cost_price: formData.cost_price,
      supplier_name: formData.supplier_name || null,
      supplier_gstin: formData.supplier_gstin || null,
      purchase_invoice_no: formData.purchase_invoice_no || null,
      purchase_date: formData.purchase_date,
      notes: formData.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (stockInError) throw new Error(stockInError.message)

  if (formData.serial_numbers && formData.serial_numbers.length > 0) {
    const serialRows = formData.serial_numbers
      .filter(s => s.trim().length > 0)
      .map(serial => ({
        product_id: formData.product_id,
        serial_number: serial.trim(),
        status: 'available' as const,
        stock_in_id: stockInRow.id,
      }))

    if (serialRows.length > 0) {
      const { error: serialError } = await supabase
        .from('product_serials')
        .insert(serialRows)
      if (serialError) throw new Error(serialError.message)
    }
  }

  revalidatePath('/stock-in')
  revalidatePath('/products')
  redirect('/stock-in')
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add actions/stock-in.ts
git commit -m "feat: Phase 1C server actions - createStockIn + getStockIns"
```

---

### Task 3: StockInForm Component

**Files:**
- Create: `components/stock-in/StockInForm.tsx`

**Key behaviours:**
- Selecting a product auto-fills `cost_price` from `product.cost_price`.
- Changing `quantity` resizes the serial-number inputs array (only when `selectedProduct.serial_required === true`).
- On submit, if `serial_required` and any serial input is blank, show toast error and abort.
- After successful `createStockIn`, the server action redirects — the `setSubmitting(false)` in the catch branch handles error recovery only.

- [ ] **Step 1: Write `components/stock-in/StockInForm.tsx`**

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'
import { createStockIn } from '@/actions/stock-in'
import type { Product } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const stockInSchema = z.object({
  product_id: z.string().min(1, 'Select a product'),
  quantity: z.coerce.number().int().min(1, 'Min 1'),
  cost_price: z.coerce.number().min(0, 'Required'),
  supplier_name: z.string().optional(),
  supplier_gstin: z.string().optional(),
  purchase_invoice_no: z.string().optional(),
  purchase_date: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})

type StockInFormValues = z.infer<typeof stockInSchema>

interface StockInFormProps {
  products: Product[]
}

export default function StockInForm({ products }: StockInFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serialInputs, setSerialInputs] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockInFormValues>({
    resolver: zodResolver(stockInSchema) as Resolver<StockInFormValues>,
    defaultValues: {
      purchase_date: new Date().toISOString().slice(0, 10),
      quantity: 1,
    },
  })

  const selectedProductId = watch('product_id')
  const quantity = watch('quantity')

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  )

  useEffect(() => {
    if (selectedProduct) {
      setValue('cost_price', selectedProduct.cost_price)
    }
  }, [selectedProduct, setValue])

  useEffect(() => {
    if (selectedProduct?.serial_required && quantity > 0) {
      setSerialInputs(prev => {
        const newArr = Array(quantity).fill('')
        for (let i = 0; i < Math.min(prev.length, quantity); i++) {
          newArr[i] = prev[i]
        }
        return newArr
      })
    } else {
      setSerialInputs([])
    }
  }, [selectedProduct?.serial_required, selectedProduct?.id, quantity])

  async function onSubmit(values: StockInFormValues) {
    if (selectedProduct?.serial_required) {
      const missing = serialInputs.some(s => !s.trim())
      if (missing) {
        toast.error('Enter all serial numbers before saving.')
        return
      }
    }

    setSubmitting(true)
    try {
      await createStockIn({
        ...values,
        serial_numbers: selectedProduct?.serial_required ? serialInputs : undefined,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add stock.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
      {/* Product */}
      <div className="space-y-2">
        <Label htmlFor="product_id">Product *</Label>
        <select
          id="product_id"
          {...register('product_id')}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">— Select product —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        {errors.product_id && (
          <p className="text-xs text-destructive">{errors.product_id.message}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity *</Label>
        <Input id="quantity" type="number" min="1" {...register('quantity')} />
        {errors.quantity && (
          <p className="text-xs text-destructive">{errors.quantity.message}</p>
        )}
        {selectedProduct?.serial_required && quantity > 0 && (
          <p className="text-xs text-muted-foreground">
            This product requires {quantity} serial number(s).
          </p>
        )}
      </div>

      {/* Cost Price */}
      <div className="space-y-2">
        <Label htmlFor="cost_price">Cost Price (₹) *</Label>
        <Input id="cost_price" type="number" min="0" step="0.01" {...register('cost_price')} />
        {errors.cost_price && (
          <p className="text-xs text-destructive">{errors.cost_price.message}</p>
        )}
      </div>

      {/* Purchase Date */}
      <div className="space-y-2">
        <Label htmlFor="purchase_date">Purchase Date *</Label>
        <Input id="purchase_date" type="date" {...register('purchase_date')} />
        {errors.purchase_date && (
          <p className="text-xs text-destructive">{errors.purchase_date.message}</p>
        )}
      </div>

      {/* Supplier Name */}
      <div className="space-y-2">
        <Label htmlFor="supplier_name">Supplier Name</Label>
        <Input
          id="supplier_name"
          type="text"
          placeholder="e.g. ABC Distributors"
          {...register('supplier_name')}
        />
      </div>

      {/* Purchase Invoice No */}
      <div className="space-y-2">
        <Label htmlFor="purchase_invoice_no">Purchase Invoice No</Label>
        <Input
          id="purchase_invoice_no"
          type="text"
          placeholder="e.g. INV-2024-001"
          {...register('purchase_invoice_no')}
        />
      </div>

      {/* Supplier GSTIN */}
      <div className="space-y-2">
        <Label htmlFor="supplier_gstin">Supplier GSTIN</Label>
        <Input
          id="supplier_gstin"
          type="text"
          placeholder="e.g. 29ABCDE1234F1Z5"
          {...register('supplier_gstin')}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          type="text"
          placeholder="Optional notes"
          {...register('notes')}
        />
      </div>

      {/* Serial Numbers (only when product requires them) */}
      {selectedProduct?.serial_required && serialInputs.length > 0 && (
        <div className="space-y-3">
          <Label>Serial Numbers *</Label>
          <div className="space-y-2 rounded-lg border border-input p-4">
            {serialInputs.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-7 text-xs text-muted-foreground text-right shrink-0">
                  {idx + 1}.
                </span>
                <Input
                  type="text"
                  placeholder={`Serial #${idx + 1}`}
                  value={val}
                  onChange={e => {
                    const updated = [...serialInputs]
                    updated[idx] = e.target.value
                    setSerialInputs(updated)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/stock-in')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add Stock'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/stock-in/StockInForm.tsx
git commit -m "feat: Phase 1C StockInForm component with dynamic serial number inputs"
```

---

### Task 4: Stock In List Page

**Files:**
- Modify: `app/(dashboard)/stock-in/page.tsx`

Replace the current one-line stub with a full list page.

- [ ] **Step 1: Rewrite `app/(dashboard)/stock-in/page.tsx`**

```tsx
import Link from 'next/link'
import { getStockIns } from '@/actions/stock-in'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'

export default async function StockInPage() {
  const records = await getStockIns({ limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#0F172A]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            Stock In
          </h1>
          <p className="text-slate-500 text-sm mt-1">Receive inventory into your store</p>
        </div>
        <Link href="/stock-in/new">
          <Button>+ Add Stock</Button>
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 text-sm">No stock received yet.</p>
          <Link href="/stock-in/new" className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              Add First Stock Entry
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Qty</th>
                <th className="px-4 py-3 text-left font-medium">Cost Price</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">Invoice No</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    {record.products?.name ?? '—'}
                    <span className="block text-xs text-slate-400">{record.products?.sku}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{record.quantity}</td>
                  <td className="px-4 py-3 tabular-nums">
                    ₹{Number(record.cost_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{record.supplier_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {record.purchase_invoice_no ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {format(parseISO(record.purchase_date), 'dd MMM yyyy')}
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

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/stock-in/page.tsx"
git commit -m "feat: Phase 1C stock-in list page replaces stub"
```

---

### Task 5: New Stock In Page

**Files:**
- Create: `app/(dashboard)/stock-in/new/page.tsx`

This is a server component. It fetches only active products then passes them to the client form.

- [ ] **Step 1: Write `app/(dashboard)/stock-in/new/page.tsx`**

```tsx
import { getProducts } from '@/actions/products'
import StockInForm from '@/components/stock-in/StockInForm'

export default async function NewStockInPage() {
  const products = await getProducts({ status: 'active' })

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#0F172A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Add Stock
        </h1>
        <p className="text-slate-500 text-sm mt-1">Record new inventory received</p>
      </div>
      <StockInForm products={products} />
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/stock-in/new/page.tsx"
git commit -m "feat: Phase 1C new stock-in page"
```

---

### Task 6: E2E Smoke Test

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

Add a test verifying unauthenticated access to `/stock-in/new` redirects to `/login` — consistent with the existing smoke tests.

- [ ] **Step 1: Update `tests/e2e/smoke.spec.ts`**

Replace the entire file with:

```typescript
import { test, expect } from '@playwright/test'

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('unauthenticated access redirects to login', async ({ page }) => {
  await page.goto('/products/new')
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})

test('unauthenticated access to stock-in redirects to login', async ({ page }) => {
  await page.goto('/stock-in/new')
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})
```

- [ ] **Step 2: Run smoke tests**

The dev server must be running (`npm run dev` in a separate terminal).

```bash
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```
Expected output:
```
✓  login page loads
✓  unauthenticated access redirects to login
✓  unauthenticated access to stock-in redirects to login
3 passed
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test: Phase 1C smoke test - stock-in redirect"
```

---

## Self-Review

**Spec coverage:**
- ✅ Stock In form: product, qty, cost, supplier, invoice no, date, notes
- ✅ Serial number tracking: dynamic inputs appear when `serial_required=true` + qty > 0
- ✅ Auto-increment `current_stock`: Postgres trigger on `stock_in` INSERT
- ✅ `stock_history` log: same trigger inserts row with `change_type='stock_in'`
- ✅ Serial records saved to `product_serials` with `stock_in_id` reference
- ✅ Stock In history list: list page shows all records with product, qty, supplier, date
- ✅ Integration with existing `StockIn` and `ProductSerial` types in `types/database.ts`
- ✅ E2E smoke test for auth redirect

**Placeholder scan:** No TBDs, no "handle edge cases" vagueness. All steps contain complete code.

**Type consistency:**
- `StockInFormData` in `actions/stock-in.ts` matches what `StockInForm.tsx` passes to `createStockIn()`
- `StockIn` from `types/database.ts` is what `getStockIns` returns — list page uses `record.products?.name`, `record.products?.sku` which are valid on `Product` (both non-nullable)
- `Product.serial_required` (boolean), `Product.cost_price` (number) — both used correctly in `StockInForm.tsx`
