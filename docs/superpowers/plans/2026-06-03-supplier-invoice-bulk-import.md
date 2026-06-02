# Supplier Invoice Bulk Import + Payment Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload a supplier invoice, auto-extract all items via Claude AI, auto-create missing products, bulk-import stock, and track supplier payments (pending/partial/paid) with full payment history.

**Architecture:** Two new DB tables (`supplier_invoices` header + `supplier_payments` records) with `stock_in` rows linked via FK. Bulk import server action creates products + stock in a single transaction. Payment status is recomputed from sum of payments vs total_amount after every payment add/delete.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgreSQL, @anthropic-ai/sdk (already installed), react-hook-form + zod, shadcn/ui, date-fns

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/004_supplier_invoices.sql` | CREATE | New tables + FK + RLS |
| `types/database.ts` | MODIFY | Add SupplierInvoice, SupplierPayment types |
| `actions/products.ts` | MODIFY | Add getCategories() export |
| `actions/supplier-invoices.ts` | CREATE | CRUD for supplier_invoices |
| `actions/supplier-payments.ts` | CREATE | Add/delete payments + recompute status |
| `actions/import-invoice.ts` | CREATE | Bulk import: create products + stock_in |
| `components/stock-in/InvoiceBulkImport.tsx` | CREATE | 3-step bulk import UI |
| `components/stock-in/AddPaymentDialog.tsx` | CREATE | Dialog to record a payment |
| `app/(dashboard)/stock-in/import/page.tsx` | CREATE | Import invoice page |
| `app/(dashboard)/stock-in/[id]/page.tsx` | CREATE | Invoice detail: items + payment panel |
| `app/(dashboard)/stock-in/page.tsx` | MODIFY | Show supplier_invoices list with payment badges |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/004_supplier_invoices.sql`
- Apply via Supabase MCP

- [ ] **Step 1: Create migration file**

```sql
-- 004_supplier_invoices.sql
-- Supplier invoice header + payment tracking

CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_no text,
  supplier_name text,
  supplier_gstin text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL
    REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_reference text,
  payment_method text CHECK (payment_method IN ('cash', 'cheque', 'neft', 'upi', 'rtgs')),
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Link stock_in rows to their parent supplier invoice
ALTER TABLE public.stock_in
  ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid
    REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users supplier_invoices"
  ON public.supplier_invoices FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth users supplier_payments"
  ON public.supplier_payments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- project_id: `lzvyzfwbsssvofrjbndx`
- name: `004_supplier_invoices`
- query: (contents of the SQL above)

- [ ] **Step 3: Verify tables exist**

Use `mcp__supabase__list_tables` and confirm `supplier_invoices` and `supplier_payments` appear.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_supplier_invoices.sql
git commit -m "feat: add supplier_invoices and supplier_payments tables with RLS"
```

---

### Task 2: Update Types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add new types to types/database.ts**

Add after line `export type QuotationStatus = ...`:

```typescript
export type SupplierPaymentMethod = 'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'
export type SupplierPaymentStatus = 'pending' | 'partial' | 'paid'
```

Add after `StockIn` interface:

```typescript
export interface SupplierInvoice {
  id: string
  purchase_invoice_no: string | null
  supplier_name: string | null
  supplier_gstin: string | null
  purchase_date: string
  total_amount: number
  payment_status: SupplierPaymentStatus
  created_by: string | null
  created_at: string
  supplier_payments?: SupplierPayment[]
  stock_in?: StockIn[]
}

export interface SupplierPayment {
  id: string
  supplier_invoice_id: string
  amount: number
  payment_date: string
  payment_reference: string | null
  payment_method: SupplierPaymentMethod | null
  notes: string | null
  created_by: string | null
  created_at: string
}
```

Update existing `StockIn` interface — add `supplier_invoice_id`:

```typescript
export interface StockIn {
  id: string
  product_id: string
  quantity: number
  cost_price: number
  supplier_name: string | null
  supplier_gstin: string | null
  purchase_invoice_no: string | null
  purchase_date: string
  notes: string | null
  supplier_invoice_id: string | null   // ADD THIS LINE
  created_by: string | null
  created_at: string
  products?: Product
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat: add SupplierInvoice and SupplierPayment types"
```

---

### Task 3: Add getCategories to actions/products.ts

**Files:**
- Modify: `actions/products.ts`

- [ ] **Step 1: Add getCategories export**

Add this function to `actions/products.ts` after `getProduct`:

```typescript
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Category[]
}
```

Also add `Category` to the import from `@/types/database` if not already imported.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/products.ts
git commit -m "feat: export getCategories from products actions"
```

---

### Task 4: Create actions/supplier-invoices.ts

**Files:**
- Create: `actions/supplier-invoices.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupplierInvoice } from '@/types/database'

export async function getSupplierInvoices(): Promise<SupplierInvoice[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(`
      *,
      supplier_payments(id, amount, payment_date, payment_reference, payment_method, notes, created_at),
      stock_in(id, product_id, quantity, cost_price, products(id, name, sku))
    `)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SupplierInvoice[]
}

export async function getSupplierInvoice(id: string): Promise<SupplierInvoice | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(`
      *,
      supplier_payments(id, amount, payment_date, payment_reference, payment_method, notes, created_at),
      stock_in(id, product_id, quantity, cost_price, notes, products(id, name, sku))
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as SupplierInvoice
}

export async function recomputePaymentStatus(invoiceId: string): Promise<void> {
  const supabase = await createClient()

  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from('supplier_invoices').select('total_amount').eq('id', invoiceId).single(),
    supabase.from('supplier_payments').select('amount').eq('supplier_invoice_id', invoiceId),
  ])

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalAmount = Number(invoice?.total_amount ?? 0)

  const payment_status =
    totalPaid <= 0 ? 'pending' : totalPaid >= totalAmount ? 'paid' : 'partial'

  await supabase
    .from('supplier_invoices')
    .update({ payment_status })
    .eq('id', invoiceId)

  revalidatePath('/stock-in')
  revalidatePath(`/stock-in/${invoiceId}`)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/supplier-invoices.ts
git commit -m "feat: supplier-invoices server actions (get, recomputePaymentStatus)"
```

---

### Task 5: Create actions/supplier-payments.ts

**Files:**
- Create: `actions/supplier-payments.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { recomputePaymentStatus } from '@/actions/supplier-invoices'

export interface AddPaymentData {
  supplier_invoice_id: string
  amount: number
  payment_date: string
  payment_reference?: string
  payment_method?: 'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'
  notes?: string
}

export async function addSupplierPayment(data: AddPaymentData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('supplier_payments').insert({
    supplier_invoice_id: data.supplier_invoice_id,
    amount: data.amount,
    payment_date: data.payment_date,
    payment_reference: data.payment_reference || null,
    payment_method: data.payment_method || null,
    notes: data.notes || null,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  await recomputePaymentStatus(data.supplier_invoice_id)
}

export async function deleteSupplierPayment(
  paymentId: string,
  invoiceId: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('supplier_payments')
    .delete()
    .eq('id', paymentId)
  if (error) throw new Error(error.message)

  await recomputePaymentStatus(invoiceId)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/supplier-payments.ts
git commit -m "feat: supplier-payments server actions (add, delete)"
```

---

### Task 6: Create actions/import-invoice.ts

**Files:**
- Create: `actions/import-invoice.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ImportItem {
  description: string
  hsn_code?: string
  quantity: number
  unit_price: number
  action: 'use_existing' | 'create_new' | 'skip'
  product_id?: string          // when action === 'use_existing'
  new_product_name: string     // when action === 'create_new'
  new_product_category_id?: string
  new_product_gst_rate: number // default 18
}

export interface ImportInvoicePayload {
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date: string
  total_amount: number
  items: ImportItem[]
}

export async function importSupplierInvoice(payload: ImportInvoicePayload): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const activeItems = payload.items.filter(i => i.action !== 'skip')
  if (activeItems.length === 0) throw new Error('No items to import.')

  // 1. Create new products for items that need it
  const productIdMap = new Map<number, string>() // index → product_id

  for (let i = 0; i < activeItems.length; i++) {
    const item = activeItems[i]

    if (item.action === 'use_existing' && item.product_id) {
      productIdMap.set(i, item.product_id)
      continue
    }

    if (item.action === 'create_new') {
      const sku = `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const selling_price = Number((item.unit_price * 1.2).toFixed(2))

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: item.new_product_name,
          sku,
          barcode: sku,
          category_id: item.new_product_category_id || null,
          cost_price: item.unit_price,
          selling_price,
          gst_rate: item.new_product_gst_rate,
          hsn_code: item.hsn_code || null,
          low_stock_alert: 5,
          serial_required: false,
          status: 'active',
          current_stock: 0,
        })
        .select('id')
        .single()

      if (productError) throw new Error(`Failed to create product "${item.new_product_name}": ${productError.message}`)
      productIdMap.set(i, newProduct.id)
    }
  }

  // 2. Create supplier_invoices header
  const { data: supplierInvoice, error: invoiceError } = await supabase
    .from('supplier_invoices')
    .insert({
      purchase_invoice_no: payload.purchase_invoice_no || null,
      supplier_name: payload.supplier_name || null,
      supplier_gstin: payload.supplier_gstin || null,
      purchase_date: payload.purchase_date,
      total_amount: payload.total_amount,
      payment_status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError) throw new Error(invoiceError.message)
  const supplierInvoiceId = supplierInvoice.id

  // 3. Bulk insert stock_in rows
  const stockInRows = activeItems
    .map((item, i) => {
      const product_id = productIdMap.get(i)
      if (!product_id) return null
      return {
        product_id,
        quantity: item.quantity,
        cost_price: item.unit_price,
        supplier_name: payload.supplier_name || null,
        supplier_gstin: payload.supplier_gstin || null,
        purchase_invoice_no: payload.purchase_invoice_no || null,
        purchase_date: payload.purchase_date,
        notes: item.hsn_code ? `HSN: ${item.hsn_code}` : null,
        supplier_invoice_id: supplierInvoiceId,
        created_by: user.id,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (stockInRows.length > 0) {
    const { error: stockError } = await supabase.from('stock_in').insert(stockInRows)
    if (stockError) throw new Error(stockError.message)
  }

  revalidatePath('/stock-in')
  revalidatePath('/products')

  return supplierInvoiceId
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/import-invoice.ts
git commit -m "feat: importSupplierInvoice server action — bulk product create + stock_in"
```

---

### Task 7: Create components/stock-in/InvoiceBulkImport.tsx

**Files:**
- Create: `components/stock-in/InvoiceBulkImport.tsx`

This component has 3 steps: Upload → Review → Done.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ScanLineIcon, CameraIcon, ImageIcon, FileTextIcon,
  Loader2Icon, CheckCircleIcon, PlusIcon, MinusIcon
} from 'lucide-react'
import { extractInvoiceData } from '@/actions/extract-invoice'
import { importSupplierInvoice, type ImportItem } from '@/actions/import-invoice'
import { prepareFile } from '@/lib/compress-file'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product, Category } from '@/types/database'

type Step = 'upload' | 'review' | 'importing' | 'done'

interface ReviewItem {
  description: string
  hsn_code?: string
  quantity: number
  unit_price: number
  action: 'use_existing' | 'create_new' | 'skip'
  product_id?: string
  new_product_name: string
  new_product_category_id?: string
  new_product_gst_rate: number
}

interface InvoiceBulkImportProps {
  products: Product[]
  categories: Category[]
}

function findMatch(description: string, products: Product[]): Product | undefined {
  const desc = description.toLowerCase()
  const bySku = products.find(p => desc.includes(p.sku.toLowerCase()))
  if (bySku) return bySku
  return products.find(p => {
    const name = p.name.toLowerCase()
    return desc.includes(name) || name.includes(desc)
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function InvoiceBulkImport({ products, categories }: InvoiceBulkImportProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [extracting, setExtracting] = useState(false)

  // Invoice header fields
  const [supplierName, setSupplierName] = useState('')
  const [supplierGstin, setSupplierGstin] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [totalAmount, setTotalAmount] = useState('0')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])

  const cameraRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setExtracting(true)
    try {
      const prepared = await prepareFile(file)
      if (prepared.warning) toast.warning(prepared.warning)
      if (prepared.compressed) {
        toast.info(`Compressed: ${prepared.originalKB} KB → ${prepared.compressedKB} KB`, { duration: 2500 })
      }
      const base64 = await fileToBase64(prepared.file)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out. Try again.')), 40_000)
      )
      const data = await Promise.race([extractInvoiceData(base64, prepared.file.type), timeout])

      setSupplierName(data.supplier_name ?? '')
      setSupplierGstin(data.supplier_gstin ?? '')
      setInvoiceNo(data.purchase_invoice_no ?? '')
      setPurchaseDate(data.purchase_date ?? new Date().toISOString().slice(0, 10))

      const items: ReviewItem[] = (data.items ?? []).map(item => {
        const match = findMatch(item.description, products)
        return {
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          action: match ? 'use_existing' : 'create_new',
          product_id: match?.id,
          new_product_name: item.description,
          new_product_category_id: categories[0]?.id,
          new_product_gst_rate: 18,
        }
      })

      const auto = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
      setTotalAmount(auto.toFixed(2))
      setReviewItems(items)

      if (items.length === 0) {
        toast.warning('No line items found. Enter items manually.')
      }
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extract invoice.')
    } finally {
      setExtracting(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function updateItem(index: number, patch: Partial<ReviewItem>) {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function handleImport() {
    const activeItems = reviewItems.filter(i => i.action !== 'skip')
    if (activeItems.length === 0) {
      toast.error('No items selected to import.')
      return
    }
    if (!purchaseDate) {
      toast.error('Purchase date required.')
      return
    }

    setStep('importing')
    try {
      const payload: Parameters<typeof importSupplierInvoice>[0] = {
        supplier_name: supplierName || undefined,
        supplier_gstin: supplierGstin || undefined,
        purchase_invoice_no: invoiceNo || undefined,
        purchase_date: purchaseDate,
        total_amount: parseFloat(totalAmount) || 0,
        items: reviewItems.map(item => ({
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          action: item.action,
          product_id: item.product_id,
          new_product_name: item.new_product_name,
          new_product_category_id: item.new_product_category_id,
          new_product_gst_rate: item.new_product_gst_rate,
        } as ImportItem)),
      }

      const invoiceId = await importSupplierInvoice(payload)
      setStep('done')
      toast.success(`${activeItems.length} items imported successfully!`)
      setTimeout(() => router.push(`/stock-in/${invoiceId}`), 1200)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.')
      setStep('review')
    }
  }

  if (step === 'upload' || extracting) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ScanLineIcon className="size-4" />
            Upload Supplier Invoice — All Items Auto-Extracted
          </div>
          {extracting ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2Icon className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting all items from invoice…</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background py-4 text-xs font-medium hover:bg-accent transition-colors">
                <CameraIcon className="size-5 text-muted-foreground" />
                Camera
              </button>
              <button type="button" onClick={() => imageRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background py-4 text-xs font-medium hover:bg-accent transition-colors">
                <ImageIcon className="size-5 text-muted-foreground" />
                Image
              </button>
              <button type="button" onClick={() => pdfRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background py-4 text-xs font-medium hover:bg-accent transition-colors">
                <FileTextIcon className="size-5 text-muted-foreground" />
                PDF
              </button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
          <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleInputChange} />
          <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handleInputChange} />
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <CheckCircleIcon className="size-10 text-emerald-500" />
        <p className="text-sm font-medium">Import complete! Redirecting…</p>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Creating products and recording stock…</p>
      </div>
    )
  }

  // step === 'review'
  const activeCount = reviewItems.filter(i => i.action !== 'skip').length

  return (
    <div className="max-w-3xl space-y-5">
      {/* Invoice Header */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Invoice Details</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Supplier Name</Label>
            <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier name" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invoice No</Label>
            <Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-001" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Purchase Date</Label>
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Supplier GSTIN</Label>
            <Input value={supplierGstin} onChange={e => setSupplierGstin(e.target.value)} placeholder="GSTIN" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Total Invoice Amount (₹)</Label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Items Review */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{reviewItems.length} Items Extracted</h2>
          <span className="text-xs text-muted-foreground">{activeCount} will be imported</span>
        </div>

        {reviewItems.map((item, i) => (
          <div key={i} className={`rounded-lg border p-3 space-y-2 ${item.action === 'skip' ? 'opacity-40' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  Qty {item.quantity} · ₹{item.unit_price.toFixed(2)}
                  {item.hsn_code && ` · HSN ${item.hsn_code}`}
                </p>
              </div>
              <button type="button" onClick={() => updateItem(i, {
                action: item.action === 'skip' ? (item.product_id ? 'use_existing' : 'create_new') : 'skip'
              })} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                {item.action === 'skip' ? <PlusIcon className="size-4" /> : <MinusIcon className="size-4" />}
              </button>
            </div>

            {item.action !== 'skip' && (
              <div className="space-y-2">
                {/* Action selector */}
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => updateItem(i, { action: 'use_existing' })}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${item.action === 'use_existing' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    Link Existing
                  </button>
                  <button type="button"
                    onClick={() => updateItem(i, { action: 'create_new' })}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${item.action === 'create_new' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    Create New Product
                  </button>
                </div>

                {item.action === 'use_existing' && (
                  <select
                    value={item.product_id ?? ''}
                    onChange={e => updateItem(i, { product_id: e.target.value })}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
                    <option value="">— Select product —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                )}

                {item.action === 'create_new' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Product Name</Label>
                      <Input value={item.new_product_name}
                        onChange={e => updateItem(i, { new_product_name: e.target.value })}
                        className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <select
                        value={item.new_product_category_id ?? ''}
                        onChange={e => updateItem(i, { new_product_category_id: e.target.value })}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
                        <option value="">No category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">GST Rate (%)</Label>
                      <select
                        value={item.new_product_gst_rate}
                        onChange={e => updateItem(i, { new_product_gst_rate: Number(e.target.value) })}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
                        {[0, 5, 12, 18, 28].map(r => (
                          <option key={r} value={r}>{r}%</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <Button type="button" variant="outline" onClick={() => setStep('upload')}>
          Re-scan Invoice
        </Button>
        <Button type="button" onClick={handleImport} disabled={activeCount === 0}>
          Import {activeCount} Item{activeCount !== 1 ? 's' : ''} → Stock
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/stock-in/InvoiceBulkImport.tsx
git commit -m "feat: InvoiceBulkImport — 3-step bulk invoice import UI"
```

---

### Task 8: Create components/stock-in/AddPaymentDialog.tsx

**Files:**
- Create: `components/stock-in/AddPaymentDialog.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { addSupplierPayment } from '@/actions/supplier-payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AddPaymentDialogProps {
  invoiceId: string
  balance: number
  onSuccess?: () => void
}

export function AddPaymentDialog({ invoiceId, balance, onSuccess }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'>('neft')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      await addSupplierPayment({
        supplier_invoice_id: invoiceId,
        amount: amt,
        payment_date: date,
        payment_reference: reference || undefined,
        payment_method: method,
        notes: notes || undefined,
      })
      toast.success('Payment recorded.')
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">+ Add Payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" step="0.01" min="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment Method</Label>
            <select value={method} onChange={e => setMethod(e.target.value as typeof method)}
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="neft">NEFT</option>
              <option value="upi">UPI</option>
              <option value="rtgs">RTGS</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference No</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Cheque / UTR / Transaction ID" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2Icon className="size-4 animate-spin mr-2" />Saving…</> : 'Save Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/stock-in/AddPaymentDialog.tsx
git commit -m "feat: AddPaymentDialog component for supplier invoice payments"
```

---

### Task 9: Create Import Page

**Files:**
- Create: `app/(dashboard)/stock-in/import/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { getProducts, getCategories } from '@/actions/products'
import { InvoiceBulkImport } from '@/components/stock-in/InvoiceBulkImport'

export default async function ImportInvoicePage() {
  const [products, categories] = await Promise.all([
    getProducts({ status: 'active' }),
    getCategories(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Import Supplier Invoice
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload invoice — all items extracted automatically
        </p>
      </div>
      <InvoiceBulkImport products={products} categories={categories} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/stock-in/import/page.tsx"
git commit -m "feat: /stock-in/import page for bulk invoice import"
```

---

### Task 10: Create Invoice Detail Page

**Files:**
- Create: `app/(dashboard)/stock-in/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSupplierInvoice } from '@/actions/supplier-invoices'
import { deleteSupplierPayment } from '@/actions/supplier-payments'
import { AddPaymentDialog } from '@/components/stock-in/AddPaymentDialog'
import { Button } from '@/components/ui/button'
import type { SupplierPayment } from '@/types/database'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
}

interface Props {
  params: { id: string }
}

async function DeletePaymentButton({ paymentId, invoiceId }: { paymentId: string; invoiceId: string }) {
  async function handleDelete() {
    'use server'
    await deleteSupplierPayment(paymentId, invoiceId)
  }
  return (
    <form action={handleDelete}>
      <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
        Delete
      </button>
    </form>
  )
}

export default async function SupplierInvoiceDetailPage({ params }: Props) {
  const invoice = await getSupplierInvoice(params.id)
  if (!invoice) notFound()

  const payments = invoice.supplier_payments ?? []
  const stockItems = invoice.stock_in ?? []
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = Number(invoice.total_amount) - totalPaid

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
              {invoice.purchase_invoice_no ?? 'Invoice'}
            </h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[invoice.payment_status]}`}>
              {invoice.payment_status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {invoice.supplier_name ?? 'Unknown Supplier'}
            {invoice.supplier_gstin && <span className="ml-2 font-mono text-xs">{invoice.supplier_gstin}</span>}
          </p>
        </div>
        <Link href="/stock-in">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      {/* Invoice Summary */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Purchase Date</p>
          <p className="font-medium">{format(parseISO(invoice.purchase_date), 'dd MMM yyyy')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="font-medium">₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Amount Paid</p>
          <p className="font-medium text-emerald-600">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Balance Due</p>
          <p className={`font-medium ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Stock Items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{stockItems.length} Item{stockItems.length !== 1 ? 's' : ''} Received</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium">Product</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Cost Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockItems.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-xs">{item.products?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{item.products?.sku}</p>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-xs">₹{Number(item.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-xs font-medium">
                    ₹{(item.quantity * Number(item.cost_price)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Payment History</h2>
          {balance > 0 && (
            <AddPaymentDialog invoiceId={invoice.id} balance={balance} />
          )}
        </div>

        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Method</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Reference</th>
                  <th className="px-4 py-2 text-right text-xs font-medium">Amount</th>
                  <th className="px-4 py-2 text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: SupplierPayment) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-xs">{format(parseISO(p.payment_date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-2 text-xs capitalize">{p.payment_method ?? '—'}</td>
                    <td className="px-4 py-2 text-xs font-mono">{p.payment_reference ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium text-emerald-600">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeletePaymentButton paymentId={p.id} invoiceId={invoice.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/stock-in/[id]/page.tsx"
git commit -m "feat: supplier invoice detail page with items + payment history"
```

---

### Task 11: Rewrite Stock In List Page

**Files:**
- Modify: `app/(dashboard)/stock-in/page.tsx`

- [ ] **Step 1: Rewrite page to show supplier invoices**

Replace entire file with:

```typescript
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSupplierInvoices } from '@/actions/supplier-invoices'
import { getStockIns } from '@/actions/stock-in'
import { Button } from '@/components/ui/button'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
}

export default async function StockInPage() {
  const [invoices, manualEntries] = await Promise.all([
    getSupplierInvoices(),
    getStockIns({ limit: 50 }),
  ])

  const manualOnly = manualEntries.filter(r => !r.supplier_invoice_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Stock In
          </h1>
          <p className="text-slate-500 text-sm mt-1">Supplier invoices and stock received</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-in/new">
            <Button variant="outline" size="sm">+ Manual Entry</Button>
          </Link>
          <Link href="/stock-in/import">
            <Button size="sm">↑ Import Invoice</Button>
          </Link>
        </div>
      </div>

      {/* Supplier Invoices */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Supplier Invoices</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No supplier invoices imported yet.{' '}
            <Link href="/stock-in/import" className="text-primary underline">Import one</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium">Invoice No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium">Status</th>
                  <th className="px-4 py-3 text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => {
                  const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                  const balance = Number(inv.total_amount) - paid
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-xs">
                        {inv.purchase_invoice_no ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {inv.supplier_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(parseISO(inv.purchase_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        <div>₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        {balance > 0 && (
                          <div className="text-red-500">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/stock-in/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7">View →</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Stock Entries */}
      {manualOnly.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Manual Stock Entries</h2>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Cost</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualOnly.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-medium">
                      {r.products?.name ?? '—'}
                      <span className="block text-slate-400">{r.products?.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{r.quantity}</td>
                    <td className="px-4 py-2 text-xs">₹{Number(r.cost_price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {format(parseISO(r.purchase_date), 'dd MMM yyyy')}
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/stock-in/page.tsx"
git commit -m "feat: stock-in list page — supplier invoices with payment status badges"
```

---

### Task 12: Final Verification

**Files:** None new

- [ ] **Step 1: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

1. Navigate to `/stock-in` — verify two buttons: "Manual Entry" and "Import Invoice"
2. Click "Import Invoice" → upload a supplier invoice PDF/image
3. Verify all items extracted and shown in review table
4. Verify matched items show "Link Existing" pre-selected
5. Verify new items show "Create New Product" with name/category fields
6. Click "Import N Items → Stock" — verify redirect to detail page
7. On detail page — verify items listed, payment status = PENDING (red)
8. Click "+ Add Payment" — enter partial amount — verify status changes to PARTIAL (yellow)
9. Add remaining amount — verify status changes to PAID (green)
10. Verify payment history table shows all entries

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: supplier invoice bulk import + payment tracking complete"
```

---

## Summary

This plan delivers:

1. **DB**: `supplier_invoices` + `supplier_payments` tables with RLS, FK link from `stock_in`
2. **Bulk Import**: Upload invoice → Claude extracts all items → review/edit → create products + stock in one action
3. **Payment Tracking**: Pending / Partial / Paid with full payment history (amount, date, reference, method)
4. **List Page**: Supplier invoices with payment status badges + balance due + manual entries section
5. **Detail Page**: All stock items received + payment history + Add Payment button
