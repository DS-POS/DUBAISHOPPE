# Low Stock Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface low-stock products throughout the app — dashboard alert widget, products page filter, and sidebar badge — using the `low_stock_alert` threshold already on the `products` table.

**Architecture:** `low_stock_alert` column already exists on `Product` (value = threshold; 0 = disabled). A new `getLowStockProducts()` server action queries `current_stock < low_stock_alert AND low_stock_alert > 0`. The dashboard gets a collapsible low-stock widget. The products page gains a "Low Stock" filter tab. The sidebar shows a live badge count.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, shadcn/ui, Tailwind

**No DB migration needed** — `low_stock_alert` already exists on products table.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `actions/products.ts` | Modify | Add `getLowStockProducts()` action |
| `components/dashboard/LowStockWidget.tsx` | Create | Dashboard widget listing low-stock products |
| `app/(dashboard)/dashboard/page.tsx` | Modify | Add LowStockWidget |
| `app/(dashboard)/products/page.tsx` | Modify | Add low-stock filter tab |
| `components/layout/Sidebar.tsx` | Modify | Badge on Products nav link showing count |

---

### Task 1: getLowStockProducts action

**Files:**
- Modify: `actions/products.ts`

- [ ] **Step 1: Read `actions/products.ts`** to find existing exports and imports.

- [ ] **Step 2: Add `getLowStockProducts` at end of file**

```typescript
export async function getLowStockProducts(): Promise<Array<{
  id: string
  name: string
  sku: string
  current_stock: number
  low_stock_alert: number
  categories: { name: string } | null
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, current_stock, low_stock_alert, categories(name)')
    .eq('status', 'active')
    .gt('low_stock_alert', 0)
    .filter('current_stock', 'lt', supabase.rpc('get_low_stock_threshold').toString())
    .order('current_stock', { ascending: true })

  // Note: Supabase JS doesn't support column-to-column comparison directly.
  // Fetch all with alert > 0 and filter in JS:
  const { data: rows, error: err } = await supabase
    .from('products')
    .select('id, name, sku, current_stock, low_stock_alert, categories(name)')
    .eq('status', 'active')
    .gt('low_stock_alert', 0)
    .order('current_stock', { ascending: true })

  if (err) throw new Error(err.message)
  return ((rows ?? []) as Array<{
    id: string; name: string; sku: string; current_stock: number
    low_stock_alert: number; categories: { name: string } | null
  }>).filter(p => p.current_stock < p.low_stock_alert)
}
```

Wait — the above has a duplicate query. Use only the correct version:

```typescript
export async function getLowStockProducts(): Promise<Array<{
  id: string
  name: string
  sku: string
  current_stock: number
  low_stock_alert: number
  categories: { name: string } | null
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, current_stock, low_stock_alert, categories(name)')
    .eq('status', 'active')
    .gt('low_stock_alert', 0)
    .order('current_stock', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{
    id: string; name: string; sku: string; current_stock: number
    low_stock_alert: number; categories: { name: string } | null
  }>).filter(p => p.current_stock < p.low_stock_alert)
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add actions/products.ts
git commit -m "feat(low-stock): getLowStockProducts action"
```

---

### Task 2: LowStockWidget dashboard component

**Files:**
- Create: `components/dashboard/LowStockWidget.tsx`

- [ ] **Step 1: Create component**

```tsx
import Link from 'next/link'
import { AlertTriangleIcon } from 'lucide-react'
import { getLowStockProducts } from '@/actions/products'

export async function LowStockWidget() {
  const items = await getLowStockProducts()
  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-600" />
          <h2 className="font-semibold text-amber-900">Low Stock Alert</h2>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
            {items.length}
          </span>
        </div>
        <Link
          href="/products?filter=low-stock"
          className="text-xs text-amber-700 font-medium hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-50 border-b border-amber-100">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Product</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide hidden sm:table-cell">SKU</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Stock</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">Threshold</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {items.slice(0, 8).map(p => (
              <tr key={p.id} className="hover:bg-amber-50/50">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                  {p.categories?.name && (
                    <p className="text-xs text-slate-400">{p.categories.name}</p>
                  )}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 hidden sm:table-cell">{p.sku}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-sm font-bold ${p.current_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.current_stock}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-sm text-slate-500">{p.low_stock_alert}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/stock-in/new?product_id=${p.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    Restock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 8 && (
          <div className="px-5 py-3 text-center">
            <Link href="/products?filter=low-stock" className="text-xs text-amber-700 hover:underline font-medium">
              +{items.length - 8} more low-stock items
            </Link>
          </div>
        )}
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
git add components/dashboard/LowStockWidget.tsx
git commit -m "feat(low-stock): LowStockWidget dashboard component"
```

---

### Task 3: Add LowStockWidget to dashboard page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/dashboard/page.tsx`** to find the import section and the JSX layout.

- [ ] **Step 2: Add import**

At the top of the file, add:
```typescript
import { LowStockWidget } from '@/components/dashboard/LowStockWidget'
```

- [ ] **Step 3: Add widget to JSX**

Find the `{/* Recent Invoices */}` comment block near the bottom. Add the widget **before** it:

```tsx
{/* Low Stock Alerts */}
<LowStockWidget />

{/* Recent Invoices */}
```

`LowStockWidget` is an async server component — it fetches its own data and renders nothing when there are no low-stock items.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(low-stock): add LowStockWidget to dashboard"
```

---

### Task 4: Products page — low-stock filter tab

**Files:**
- Modify: `app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/products/page.tsx`** to understand current structure.

- [ ] **Step 2: Add `filter` searchParam handling**

The page receives `searchParams` — add a `filter` param. When `filter=low-stock`, show only products where `current_stock < low_stock_alert && low_stock_alert > 0`.

Add to the top of the component (after existing searchParams read):

```typescript
const filter = searchParams?.filter as string | undefined
const isLowStockFilter = filter === 'low-stock'
```

- [ ] **Step 3: Filter products in the page**

If there's a `getProducts` call, add client-side filter after fetching:

```typescript
const allProducts = await getProducts() // existing call
const displayProducts = isLowStockFilter
  ? allProducts.filter(p => p.low_stock_alert > 0 && p.current_stock < p.low_stock_alert)
  : allProducts
```

Then use `displayProducts` in the render instead of `allProducts`.

- [ ] **Step 4: Add filter tabs to JSX**

Find the products page header area. Add tabs above the product list:

```tsx
<div className="flex gap-2 flex-wrap">
  <Link
    href="/products"
    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
      !isLowStockFilter
        ? 'bg-[#111827] text-white border-[#111827]'
        : 'border-slate-200 text-slate-600 hover:border-slate-400'
    }`}
  >
    All Products ({allProducts.length})
  </Link>
  <Link
    href="/products?filter=low-stock"
    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
      isLowStockFilter
        ? 'bg-amber-500 text-white border-amber-500'
        : 'border-amber-200 text-amber-700 hover:bg-amber-50'
    }`}
  >
    ⚠ Low Stock ({allProducts.filter(p => p.low_stock_alert > 0 && p.current_stock < p.low_stock_alert).length})
  </Link>
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/products/page.tsx"
git commit -m "feat(low-stock): products page low-stock filter tab"
```

---

### Task 5: Sidebar badge on Products link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Read `components/layout/Sidebar.tsx`** to understand the nav rendering.

- [ ] **Step 2: Make Sidebar async + fetch count**

The Sidebar is currently a server component. Add data fetch for low-stock count:

```typescript
import { getLowStockProducts } from '@/actions/products'

// At top of component function body:
const lowStockItems = await getLowStockProducts().catch(() => [])
const lowStockCount = lowStockItems.length
```

- [ ] **Step 3: Add badge to Products nav item**

Find where nav items are rendered. For the Products item specifically, add a badge after the label:

```tsx
{item.href === '/products' && lowStockCount > 0 && (
  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-amber-500 text-white text-xs font-bold px-1">
    {lowStockCount > 99 ? '99+' : lowStockCount}
  </span>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(low-stock): sidebar badge on Products nav link"
```

---

### Verification Checklist

- [ ] Set `low_stock_alert = 5` on a product with `current_stock = 2`
- [ ] Dashboard shows Low Stock Alert widget with that product
- [ ] "Restock" link on widget goes to stock-in new page
- [ ] Sidebar Products link shows amber badge with count
- [ ] Products page shows "⚠ Low Stock (1)" tab
- [ ] Click tab → only low-stock products shown
- [ ] Click "All Products" tab → full list restored
- [ ] Set `low_stock_alert = 0` on product → disappears from alerts
- [ ] No low-stock products → widget hidden from dashboard
