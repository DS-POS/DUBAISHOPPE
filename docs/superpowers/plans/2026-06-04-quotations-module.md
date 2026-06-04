# Quotations Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full quotations module — create, list, view, status-update, convert to invoice — reusing billing cart components.

**Architecture:** Server actions in `actions/quotations.ts` handle all DB operations; a client-side `QuotationForm` reuses existing billing components (ProductSearch, CartItemRow, CustomerSelector, CartSummary, types); server-page components render list and detail views matching existing invoice page style.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase PostgreSQL, `date-fns`, `sonner`, `lucide-react`

---

### Task 1: DB Migration — Quotation Number Sequence

**Files:**
- Create: `supabase/migrations/007_quotation_sequence.sql`

- [ ] **Step 1: Create migration file**

```sql
CREATE SEQUENCE IF NOT EXISTS quotation_no_seq START 1;

CREATE OR REPLACE FUNCTION next_quotation_no()
RETURNS text LANGUAGE sql AS $$
  SELECT 'QUO-' || LPAD(nextval('quotation_no_seq')::text, 6, '0');
$$;

ALTER TABLE public.quotations
  ALTER COLUMN quotation_no SET DEFAULT next_quotation_no();
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- project_id: `lzvyzfwbsssvofrjbndx`
- name: `007_quotation_sequence`
- query: the SQL above

- [ ] **Step 3: Commit**

```
git add supabase/migrations/007_quotation_sequence.sql
git commit -m "feat: quotation number sequence migration"
```

---

### Task 2: Server Actions — `actions/quotations.ts`

**Files:**
- Create: `actions/quotations.ts`

- [ ] **Step 1: Write all server actions**

Full file at `actions/quotations.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createInvoice } from '@/actions/invoices'
import type { Quotation, QuotationItem, QuotationStatus } from '@/types/database'

export interface CreateQuotationItem {
  product_id: string
  product_name: string
  sku: string | null
  hsn_code: string | null
  quantity: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface CreateQuotationData {
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  valid_until: string | null
  notes: string | null
  items: CreateQuotationItem[]
}

export async function createQuotation(data: CreateQuotationData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: qRow, error: qError } = await supabase
    .from('quotations')
    .insert({
      customer_id: data.customer_id,
      subtotal: data.subtotal,
      discount: data.discount,
      taxable_amount: data.taxable_amount,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      total_gst: data.total_gst,
      grand_total: data.grand_total,
      valid_until: data.valid_until,
      notes: data.notes,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (qError) throw new Error(qError.message)
  const quotationId = qRow.id

  const itemRows = data.items.map(item => ({
    quotation_id: quotationId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))
  const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows)
  if (itemsError) throw new Error(itemsError.message)

  revalidatePath('/quotations')
  return quotationId
}

export async function getAllQuotations(): Promise<(Quotation & {
  customers: { name: string } | null
})[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as never
}

export async function getQuotation(id: string): Promise<(Quotation & {
  customers: { name: string; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string } | null
  quotation_items: QuotationItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('*, customers(*), quotation_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
  revalidatePath(`/quotations/${id}`)
}

export async function convertQuotationToInvoice(quotationId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const quotation = await getQuotation(quotationId)
  if (!quotation) throw new Error('Quotation not found')

  const items = (quotation.quotation_items ?? []).map(item => ({
    product_id: item.product_id ?? '',
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    serial_number: null,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gst_rate: item.gst_rate,
    taxable_amount: item.taxable_amount,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }))

  const invoiceId = await createInvoice({
    customer_id: quotation.customer_id,
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    taxable_amount: quotation.taxable_amount,
    cgst: quotation.cgst,
    sgst: quotation.sgst,
    igst: quotation.igst,
    total_gst: quotation.total_gst,
    grand_total: quotation.grand_total,
    payment_method: 'cash',
    amount_paid: 0,
    items,
  })

  const { error } = await supabase
    .from('quotations')
    .update({ status: 'accepted', converted_invoice_id: invoiceId })
    .eq('id', quotationId)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
  revalidatePath(`/quotations/${quotationId}`)
  revalidatePath('/invoices')
  return invoiceId
}

export async function deleteQuotation(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: q } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', id)
    .single()
  if (!q) throw new Error('Quotation not found')
  if (q.status !== 'draft') throw new Error('Only draft quotations can be deleted')

  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/quotations')
}
```

- [ ] **Step 2: Commit**

```
git add actions/quotations.ts
git commit -m "feat: quotations server actions"
```

---

### Task 3: Quotations List Page

**Files:**
- Modify: `app/(dashboard)/quotations/page.tsx`

- [ ] **Step 1: Replace placeholder with full server component**

```typescript
import Link from 'next/link'
import { getAllQuotations } from '@/actions/quotations'
import { format } from 'date-fns'
import { PlusIcon, FileTextIcon } from 'lucide-react'
import { round2 } from '@/lib/gst'
import type { QuotationStatus } from '@/types/database'

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
}

const STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const allQuotations = await getAllQuotations()
  const activeStatus = searchParams.status ?? 'all'
  const tabs = ['all', 'draft', 'sent', 'accepted', 'expired', 'rejected']

  const filtered =
    activeStatus === 'all'
      ? allQuotations
      : allQuotations.filter(q => q.status === activeStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#5C4A3A]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            Quotations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {allQuotations.length} total quotation{allQuotations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center gap-2 bg-[#9A8472] hover:bg-[#7A6558] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <PlusIcon className="size-4" />
          New Quotation
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0">
        {tabs.map(tab => (
          <Link
            key={tab}
            href={tab === 'all' ? '/quotations' : `/quotations?status=${tab}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
              activeStatus === tab
                ? 'bg-white border border-b-white border-slate-200 text-[#5C4A3A] -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'all'
              ? `All (${allQuotations.length})`
              : `${STATUS_LABELS[tab as QuotationStatus]} (${allQuotations.filter(q => q.status === tab).length})`}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-[#FAF7F2] p-16 text-center">
          <div className="w-16 h-16 bg-[#F6F0E6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileTextIcon className="size-8 text-[#9A8472]" />
          </div>
          <p className="font-semibold text-[#5C4A3A]">No quotations found</p>
          <p className="text-sm text-slate-500 mt-1">
            {activeStatus === 'all'
              ? 'Create your first quotation to get started'
              : `No ${activeStatus} quotations`}
          </p>
          {activeStatus === 'all' && (
            <Link
              href="/quotations/new"
              className="mt-4 inline-flex items-center gap-2 bg-[#9A8472] hover:bg-[#7A6558] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <PlusIcon className="size-4" />
              New Quotation
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF7F2] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Quotation #</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Customer</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Valid Until</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <tr
                  key={q.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-[#FAF7F2] transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-[#5C4A3A]">
                    {q.quotation_no}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {q.customers?.name ?? <span className="text-slate-400">Walk-in</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    ₹{round2(q.grand_total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {q.valid_until
                      ? format(new Date(q.valid_until), 'dd MMM yyyy')
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        STATUS_CLASSES[q.status as QuotationStatus]
                      }`}
                    >
                      {STATUS_LABELS[q.status as QuotationStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {format(new Date(q.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-[#9A8472] hover:text-[#7A6558] font-semibold text-xs hover:underline transition-colors"
                    >
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

- [ ] **Step 2: Commit**

```
git add app/(dashboard)/quotations/page.tsx
git commit -m "feat: quotations list page with status filter tabs"
```

---

### Task 4: New Quotation Page (server component wrapper)

**Files:**
- Create: `app/(dashboard)/quotations/new/page.tsx`

- [ ] **Step 1: Create page**

```typescript
import { getProducts } from '@/actions/products'
import { getCustomers } from '@/actions/customers'
import QuotationForm from '@/components/quotations/QuotationForm'

export default async function NewQuotationPage() {
  const [products, customers] = await Promise.all([
    getProducts({ status: 'active' }),
    getCustomers(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-2xl font-bold text-[#5C4A3A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          New Quotation
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Build the quote — no payment, no serial required
        </p>
      </div>
      <QuotationForm products={products} customers={customers} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add app/(dashboard)/quotations/new/page.tsx
git commit -m "feat: new quotation page"
```

---

### Task 5: QuotationForm client component

**Files:**
- Create: `components/quotations/QuotationForm.tsx`

- [ ] **Step 1: Write full component**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Product, Customer } from '@/types/database'
import { type CartItem, recalcItem, cartTotals } from '@/components/billing/types'
import { ProductSearch } from '@/components/billing/ProductSearch'
import { CartItemRow } from '@/components/billing/CartItemRow'
import { CustomerSelector } from '@/components/billing/CustomerSelector'
import { CartSummary } from '@/components/billing/CartSummary'
import { createQuotation } from '@/actions/quotations'
import type { CreateQuotationData } from '@/actions/quotations'
import { FileTextIcon, SaveIcon } from 'lucide-react'

interface QuotationFormProps {
  products: Product[]
  customers: Customer[]
}

export default function QuotationForm({ products, customers }: QuotationFormProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const customerState = customer?.state ?? 'Telangana'

  function addProduct(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && !product.serial_required)
      if (existing) {
        return prev.map(i =>
          i._id === existing._id
            ? recalcItem({ ...i, quantity: i.quantity + 1 }, customerState)
            : i
        )
      }
      const newItem: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total' | 'discount'> = {
        _id: crypto.randomUUID(),
        product,
        quantity: 1,
        rate: product.selling_price,
        discount_mode: 'percent',
        discount_raw: 0,
        serial_number: null,
      }
      return [...prev, recalcItem(newItem, customerState)]
    })
  }

  function updateQty(id: string, qty: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, quantity: qty }, customerState) : i))
  }

  function updateRate(id: string, rate: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, rate }, customerState) : i))
  }

  function updateDiscountRaw(id: string, raw: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount_raw: raw }, customerState) : i))
  }

  function updateDiscountMode(id: string, mode: 'percent' | 'flat') {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount_mode: mode }, customerState) : i))
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i._id !== id))
  }

  const handleCustomerChange = useCallback((c: Customer | null) => {
    setCustomer(c)
    const state = c?.state ?? 'Telangana'
    setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
  }, [])

  async function handleSave() {
    if (cart.length === 0) {
      toast.error('Cart is empty.')
      return
    }
    setSaving(true)
    try {
      const totals = cartTotals(cart)
      const data: CreateQuotationData = {
        customer_id: customer?.id ?? null,
        ...totals,
        valid_until: validUntil || null,
        notes: notes || null,
        items: cart.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          sku: i.product.sku,
          hsn_code: i.product.hsn_code,
          quantity: i.quantity,
          rate: i.rate,
          discount: i.discount,
          gst_rate: i.product.gst_rate,
          taxable_amount: i.taxable_amount,
          cgst: i.cgst,
          sgst: i.sgst,
          igst: i.igst,
          total: i.total,
        })),
      }
      const id = await createQuotation(data)
      toast.success('Quotation saved!')
      router.push(`/quotations/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quotation')
    } finally {
      setSaving(false)
    }
  }

  const totals = cartTotals(cart)

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-0">
      {/* Left: Cart */}
      <div className="flex-1 min-w-0 space-y-4">
        <ProductSearch products={products} onAdd={addProduct} />

        {cart.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileTextIcon className="size-8 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">No items yet</p>
            <p className="text-sm text-slate-500 mt-1">Search for a product above to add to this quotation</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Disc.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">GST%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map(item => (
                  <CartItemRow
                    key={item._id}
                    item={item}
                    onQtyChange={updateQty}
                    onRateChange={updateRate}
                    onDiscountChange={updateDiscountRaw}
                    onDiscountModeChange={updateDiscountMode}
                    onRemove={removeItem}
                    onPickSerial={() => {}}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: Sidebar */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</p>
          <CustomerSelector
            customers={customers}
            selected={customer}
            onSelect={handleCustomerChange}
          />
          {customer && (
            <p className="text-xs text-slate-400 px-1">
              State: {customer.state} → GST: {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
            </p>
          )}
        </div>

        {/* Valid Until */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valid Until</p>
          <input
            type="date"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-[#9A8472]/20 focus:border-[#9A8472] transition-all"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes for the customer…"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9A8472]/20 focus:border-[#9A8472] transition-all resize-none"
          />
        </div>

        <CartSummary {...totals} itemCount={cart.length} />

        <button
          type="button"
          onClick={handleSave}
          disabled={cart.length === 0 || saving}
          className="w-full h-13 bg-[#9A8472] hover:bg-[#7A6558] disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
        >
          <SaveIcon className="size-5" />
          {saving ? 'Saving…' : 'Save Quotation'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add components/quotations/QuotationForm.tsx
git commit -m "feat: QuotationForm client component"
```

---

### Task 6: Quotation Detail Page

**Files:**
- Create: `app/(dashboard)/quotations/[id]/page.tsx`

- [ ] **Step 1: Write full server component**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getQuotation, updateQuotationStatus, convertQuotationToInvoice } from '@/actions/quotations'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'
import type { QuotationStatus } from '@/types/database'
import { QuotationActions } from '@/components/quotations/QuotationActions'

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
}

const STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const quotation = await getQuotation(params.id)
  if (!quotation) notFound()

  const customer = quotation.customers
  const items = quotation.quotation_items ?? []
  const isIGST = quotation.igst > 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/quotations"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeftIcon className="size-3.5" /> Quotations
          </Link>
          <h1
            className="text-2xl font-bold text-[#5C4A3A]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            {quotation.quotation_no}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(quotation.created_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        <QuotationActions
          quotationId={quotation.id}
          quotationNo={quotation.quotation_no}
          status={quotation.status}
          convertedInvoiceId={quotation.converted_invoice_id}
          grandTotal={quotation.grand_total}
          customerPhone={customer?.phone ?? null}
        />
      </div>

      {/* Customer Card */}
      <div className="rounded-xl border border-border bg-[#FAF7F2] p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-base text-[#5C4A3A]">
              {customer ? customer.name : 'Walk-in Customer'}
            </p>
            {customer?.business_name && (
              <p className="text-sm text-muted-foreground">{customer.business_name}</p>
            )}
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[quotation.status]}`}
          >
            {STATUS_LABELS[quotation.status]}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {customer?.phone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{customer.phone}</p>
            </div>
          )}
          {customer?.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium break-all">{customer.email}</p>
            </div>
          )}
          {customer?.gstin && (
            <div>
              <p className="text-xs text-muted-foreground">GSTIN</p>
              <p className="font-medium font-mono text-xs">{customer.gstin}</p>
            </div>
          )}
          {customer?.state && (
            <div>
              <p className="text-xs text-muted-foreground">State</p>
              <p className="font-medium">{customer.state}</p>
            </div>
          )}
          {customer?.address && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-medium">{customer.address}</p>
            </div>
          )}
        </div>
        {quotation.valid_until && (
          <div className="mt-3 pt-3 border-t border-[#F6F0E6]">
            <p className="text-xs text-muted-foreground">Valid Until</p>
            <p className="font-medium text-sm mt-0.5">
              {format(new Date(quotation.valid_until), 'dd MMM yyyy')}
            </p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F6F0E6] border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rate</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxable</th>
              {isIGST
                ? <th className="px-3 py-2 text-right font-medium text-muted-foreground">IGST</th>
                : <>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">CGST</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">SGST</th>
                  </>
              }
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">₹{round2(item.rate).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">₹{round2(item.taxable_amount).toFixed(2)}</td>
                {isIGST
                  ? <td className="px-3 py-2 text-right">₹{round2(item.igst).toFixed(2)}</td>
                  : <>
                      <td className="px-3 py-2 text-right">₹{round2(item.cgst).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{round2(item.sgst).toFixed(2)}</td>
                    </>
                }
                <td className="px-3 py-2 text-right font-semibold">₹{round2(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>₹{round2(quotation.subtotal).toFixed(2)}</span>
          </div>
          {quotation.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="text-emerald-600">−₹{round2(quotation.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable Amount</span><span>₹{round2(quotation.taxable_amount).toFixed(2)}</span>
          </div>
          {isIGST ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span><span>₹{round2(quotation.igst).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span><span>₹{round2(quotation.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span><span>₹{round2(quotation.sgst).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span><span>₹{round2(quotation.grand_total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <div className="rounded-xl border border-[#F6F0E6] bg-[#FAF7F2] p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add app/(dashboard)/quotations/[id]/page.tsx
git commit -m "feat: quotation detail page"
```

---

### Task 7: QuotationActions client component

**Files:**
- Create: `components/quotations/QuotationActions.tsx`

This is a client component for interactive actions (status change dropdown, convert to invoice button, WhatsApp share).

- [ ] **Step 1: Write component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateQuotationStatus, convertQuotationToInvoice } from '@/actions/quotations'
import type { QuotationStatus } from '@/types/database'
import { ChevronDownIcon, FileCheckIcon, MessageCircleIcon, PrinterIcon } from 'lucide-react'

interface QuotationActionsProps {
  quotationId: string
  quotationNo: string
  status: QuotationStatus
  convertedInvoiceId: string | null
  grandTotal: number
  customerPhone: string | null
}

const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent', 'expired', 'rejected'],
  sent: ['accepted', 'expired', 'rejected'],
  accepted: [],
  expired: ['draft'],
  rejected: ['draft'],
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Mark as Sent',
  accepted: 'Mark as Accepted',
  expired: 'Mark as Expired',
  rejected: 'Mark as Rejected',
}

export function QuotationActions({
  quotationId,
  quotationNo,
  status,
  convertedInvoiceId,
  grandTotal,
  customerPhone,
}: QuotationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [converting, setConverting] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const transitions = STATUS_TRANSITIONS[status] ?? []

  function handleStatusChange(newStatus: QuotationStatus) {
    setShowStatusMenu(false)
    startTransition(async () => {
      try {
        await updateQuotationStatus(quotationId, newStatus)
        toast.success(`Status updated to ${newStatus}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  async function handleConvert() {
    if (!confirm('Convert this quotation to an invoice? This cannot be undone.')) return
    setConverting(true)
    try {
      const invoiceId = await convertQuotationToInvoice(quotationId)
      toast.success('Quotation converted to invoice!')
      router.push(`/invoices/${invoiceId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert to invoice')
      setConverting(false)
    }
  }

  function handleWhatsApp() {
    const msg = `Hi! Please find your quotation *${quotationNo}* for ₹${grandTotal.toFixed(2)}.\n\nThank you for your interest in Dubai Shoppe.`
    const phone = customerPhone?.replace(/[^0-9]/g, '') ?? ''
    const url = `https://wa.me/${phone ? `91${phone}` : ''}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function handlePrint() {
    window.print()
  }

  const canConvert = status !== 'accepted' && status !== 'rejected'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* WhatsApp */}
      <button
        type="button"
        onClick={handleWhatsApp}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <MessageCircleIcon className="size-4 text-green-600" />
        WhatsApp
      </button>

      {/* Print */}
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <PrinterIcon className="size-4 text-slate-500" />
        Print
      </button>

      {/* Status change dropdown */}
      {transitions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusMenu(v => !v)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
          >
            Update Status
            <ChevronDownIcon className="size-3.5" />
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-xl z-20 overflow-hidden">
              {transitions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-slate-700"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Convert to Invoice */}
      {canConvert && !convertedInvoiceId && (
        <button
          type="button"
          onClick={handleConvert}
          disabled={converting}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#9A8472] hover:bg-[#7A6558] text-white shadow-sm transition-colors disabled:opacity-50"
        >
          <FileCheckIcon className="size-4" />
          {converting ? 'Converting…' : 'Convert to Invoice'}
        </button>
      )}

      {/* View Invoice (if converted) */}
      {convertedInvoiceId && (
        <a
          href={`/invoices/${convertedInvoiceId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
        >
          <FileCheckIcon className="size-4" />
          View Invoice
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add components/quotations/QuotationActions.tsx
git commit -m "feat: QuotationActions client component"
```

---

### Task 8: Verify TypeScript + lint

- [ ] **Step 1: Run typecheck**

```
npm run typecheck
```

Expected: no errors

- [ ] **Step 2: Run lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 3: Fix any issues found, then commit fixes**

---

## Self-Review

**Spec coverage:**
- DB migration: Task 1
- `createQuotation`, `getAllQuotations`, `getQuotation`, `updateQuotationStatus`, `convertQuotationToInvoice`, `deleteQuotation`: Task 2
- Quotations list page with status filter tabs: Task 3
- New quotation page server wrapper: Task 4
- QuotationForm with ProductSearch/CartItemRow/CustomerSelector/CartSummary/ValidUntil/Notes: Task 5
- Quotation detail with customer card, items table, totals, notes: Task 6
- QuotationActions with status update, convert, WhatsApp, print: Task 7
- No serial picking (correct — quotations don't need serials): Task 5 passes `onPickSerial={() => {}}` since CartItemRow requires the prop

**Type consistency check:**
- `CreateQuotationData` defined in Task 2 and imported in Task 5: consistent
- `QuotationStatus` from `types/database` used in Task 2, 3, 6, 7: consistent
- `QuotationActions` props passed from detail page in Task 6 match interface in Task 7: consistent
- `cartTotals` return spread into `CreateQuotationData` in Task 5: `cartTotals` returns `subtotal, discount, taxable_amount, cgst, sgst, igst, total_gst, grand_total` — all fields present in `CreateQuotationData` (valid spread)
