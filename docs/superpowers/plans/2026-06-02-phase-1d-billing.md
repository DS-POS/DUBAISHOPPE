# Phase 1D: Billing + GST Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete billing/POS screen — cart-based sale, GST auto-calculation, invoice save with stock deduction, A4 PDF generation, and WhatsApp/email sharing.

**Architecture:** `BillingForm` client component owns cart state; a server action `createInvoice` handles the full atomic transaction (verify stock → insert invoice + items → deduct stock → log history → mark serials sold). PDF generated on-demand via `/api/invoices/[id]/pdf` route using `@react-pdf/renderer`. Email via `resend`. WhatsApp via `wa.me` link.

**Tech Stack:** Next.js 14 App Router · TypeScript · shadcn/ui · `@react-pdf/renderer` v4 · `resend` v6 · `@zxing/browser` (barcode camera scan) · `lib/gst.ts` (existing GST util) · Supabase Postgres · `sonner` toasts

---

## Store Constants (hardcoded on every invoice)

```typescript
// Used in PDF + email templates
export const STORE = {
  name: 'DUBAI SHOPPE',
  address: '5-1-750/2, Haridas Market Bank Street, Koti',
  city: 'Hyderabad - 500095',
  gstin: '36ALBPM0907C1ZO',
  state: 'Telangana',
  state_code: '36',
  phone: '9849436070 / 9885878645',
} as const
```

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/003_invoice_sequence.sql` | Create | Postgres sequence + `next_invoice_no()` function |
| `lib/store-constants.ts` | Create | Store name/address/GSTIN constants |
| `actions/customers.ts` | Create | `getCustomers`, `createCustomer`, `updateCustomer`, `getCustomerById` |
| `actions/invoices.ts` | Create | `createInvoice`, `getInvoices`, `getInvoice`, `cancelInvoice` |
| `actions/send-invoice-email.ts` | Create | Resend email with invoice summary |
| `components/customers/CustomerForm.tsx` | Create | Add/edit customer form |
| `components/billing/types.ts` | Create | `CartItem` interface + `recalcItem` helper |
| `components/billing/ProductSearch.tsx` | Create | Text search + barcode camera scan → add to cart |
| `components/billing/CartItemRow.tsx` | Create | Single cart row: qty controls, rate, discount, GST total |
| `components/billing/SerialPicker.tsx` | Create | Modal to pick available serial for serial-required products |
| `components/billing/CustomerSelector.tsx` | Create | Walk-in toggle + search existing customers |
| `components/billing/CartSummary.tsx` | Create | Subtotal, GST breakdown, grand total display |
| `components/billing/PaymentModal.tsx` | Create | Payment method selector + confirm button |
| `components/billing/BillingForm.tsx` | Create | Main orchestrator — all cart state + submission logic |
| `components/invoices/InvoicePDF.tsx` | Create | `@react-pdf/renderer` A4 GST invoice template |
| `components/invoices/InvoiceShareButtons.tsx` | Create | Download PDF + WhatsApp + Email buttons |
| `app/(dashboard)/billing/page.tsx` | Modify | Replace stub with `BillingForm` |
| `app/(dashboard)/customers/page.tsx` | Modify | Customer list with add button |
| `app/(dashboard)/customers/new/page.tsx` | Create | New customer page |
| `app/(dashboard)/customers/[id]/edit/page.tsx` | Create | Edit customer page |
| `app/(dashboard)/invoices/page.tsx` | Modify | Invoice list with filters |
| `app/(dashboard)/invoices/[id]/page.tsx` | Create | Invoice detail + share buttons |
| `app/api/invoices/[id]/pdf/route.ts` | Create | Stream A4 PDF to browser |

---

## Codebase Context (read before implementing)

- **Supabase client (server):** `import { createClient } from '@/lib/supabase/server'` — async function, call `await createClient()`
- **GST util:** `import { calculateLineGST, round2 } from '@/lib/gst.ts'` — `calculateLineGST({ rate, quantity, discount, gst_rate }, customerState)` returns `{ taxable_amount, cgst, sgst, igst, total_gst, total }`
- **Invoice number formatter:** `import { formatInvoiceNo } from '@/lib/invoice-number'`
- **Types:** All interfaces in `types/database.ts` — `Product`, `Customer`, `Invoice`, `InvoiceItem`
- **Toast:** `import { toast } from 'sonner'`
- **Page heading pattern:** `<h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>`
- **Form pattern:** react-hook-form v7 + zod v4 + `zodResolver(schema) as Resolver<FormValues>`
- **`z.coerce.number()`** for numeric zod fields
- **Existing GST logic:** `customerState.toLowerCase() === 'telangana'` → CGST + SGST; else → IGST
- **Stock deduction:** `UPDATE products SET current_stock = current_stock - qty WHERE id = product_id`
- **Stock history:** insert into `stock_history` with `change_type = 'sale'`, negative `quantity_change`
- **Serial mark sold:** `UPDATE product_serials SET status = 'sold', invoice_id = ? WHERE serial_number = ? AND product_id = ?`

---

## Task 1: DB Migration — Invoice Number Sequence

**Files:**
- Create: `supabase/migrations/003_invoice_sequence.sql`

**Note:** After writing the file, user must run SQL in Supabase Dashboard → SQL Editor → New Query.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 003_invoice_sequence.sql
-- Atomic sequential invoice number generation

CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_no()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_no_seq')::text, 6, '0');
$$;

-- Set as default on invoices table
ALTER TABLE public.invoices
  ALTER COLUMN invoice_no SET DEFAULT next_invoice_no();
```

- [ ] **Step 2: Save file to `supabase/migrations/003_invoice_sequence.sql`**

- [ ] **Step 3: Notify user to run in Supabase SQL Editor**

Print to console / document: "Run `supabase/migrations/003_invoice_sequence.sql` in Supabase Dashboard → SQL Editor"

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_invoice_sequence.sql
git commit -m "feat: invoice number sequence + next_invoice_no() DB function"
```

---

## Task 2: Store Constants

**Files:**
- Create: `lib/store-constants.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/store-constants.ts
export const STORE = {
  name: 'DUBAI SHOPPE',
  address: '5-1-750/2, Haridas Market Bank Street, Koti',
  city: 'Hyderabad - 500095',
  gstin: '36ALBPM0907C1ZO',
  state: 'Telangana',
  state_code: '36',
  phone: '9849436070 / 9885878645',
} as const
```

- [ ] **Step 2: Commit**

```bash
git add lib/store-constants.ts
git commit -m "feat: store constants for invoice header"
```

---

## Task 3: Customer CRUD

**Files:**
- Create: `actions/customers.ts`
- Create: `components/customers/CustomerForm.tsx`
- Modify: `app/(dashboard)/customers/page.tsx`
- Create: `app/(dashboard)/customers/new/page.tsx`
- Create: `app/(dashboard)/customers/[id]/edit/page.tsx`

- [ ] **Step 1: Create `actions/customers.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Customer } from '@/types/database'

export async function getCustomers(search?: string): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })
    .limit(200)

  if (search?.trim()) {
    query = query.or(
      `name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,gstin.ilike.%${search.trim()}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Customer[]
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Customer
}

export interface CustomerFormData {
  name: string
  phone?: string
  email?: string
  gstin?: string
  address?: string
  state: string
}

export async function createCustomer(formData: CustomerFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('customers').insert({
    name: formData.name.trim(),
    phone: formData.phone?.trim() || null,
    email: formData.email?.trim() || null,
    gstin: formData.gstin?.trim().toUpperCase() || null,
    address: formData.address?.trim() || null,
    state: formData.state || 'Telangana',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  redirect('/customers')
}

export async function updateCustomer(id: string, formData: CustomerFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('customers')
    .update({
      name: formData.name.trim(),
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim().toUpperCase() || null,
      address: formData.address?.trim() || null,
      state: formData.state || 'Telangana',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  redirect('/customers')
}
```

- [ ] **Step 2: Create `components/customers/CustomerForm.tsx`**

```typescript
'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'
import { createCustomer, updateCustomer } from '@/actions/customers'
import type { Customer } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gstin: z.string().optional(),
  address: z.string().optional(),
  state: z.string().min(1, 'State required'),
})
type FormValues = z.infer<typeof schema>

interface Props {
  customer?: Customer
}

export default function CustomerForm({ customer }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      gstin: customer?.gstin ?? '',
      address: customer?.address ?? '',
      state: customer?.state ?? 'Telangana',
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (customer) {
          await updateCustomer(customer.id, values)
        } else {
          await createCustomer(values)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save customer.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input placeholder="e.g. Rahul Sharma" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input type="tel" placeholder="9876543210" {...register('phone')} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" placeholder="customer@example.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>GSTIN</Label>
        <Input placeholder="29ABCDE1234F1Z5" {...register('gstin')} />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input placeholder="Street, City, Pincode" {...register('address')} />
      </div>
      <div className="space-y-2">
        <Label>State *</Label>
        <select
          {...register('state')}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {INDIAN_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/customers')} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Replace `app/(dashboard)/customers/page.tsx`**

```typescript
import Link from 'next/link'
import { getCustomers } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Customers
          </h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/customers/new">
          <Button><PlusIcon className="size-4 mr-2" />Add Customer</Button>
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No customers yet.</p>
          <Link href="/customers/new">
            <Button className="mt-4">Add First Customer</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">State</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">GSTIN</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.state}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.gstin ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}/edit`} className="text-xs text-primary hover:underline">
                      Edit
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

- [ ] **Step 4: Create `app/(dashboard)/customers/new/page.tsx`**

```typescript
import CustomerForm from '@/components/customers/CustomerForm'

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Add Customer
        </h1>
        <p className="text-slate-500 text-sm mt-1">Add a new customer record</p>
      </div>
      <CustomerForm />
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(dashboard)/customers/[id]/edit/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import { getCustomerById } from '@/actions/customers'

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const customer = await getCustomerById(params.id)
  if (!customer) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Edit Customer
        </h1>
        <p className="text-slate-500 text-sm mt-1">{customer.name}</p>
      </div>
      <CustomerForm customer={customer} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add actions/customers.ts components/customers/CustomerForm.tsx app/\(dashboard\)/customers/
git commit -m "feat: customer CRUD — list, add, edit pages"
```

---

## Task 4: Invoice Server Action

**Files:**
- Create: `actions/invoices.ts`

- [ ] **Step 1: Create `actions/invoices.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Invoice, InvoiceItem } from '@/types/database'

export interface CreateInvoiceItem {
  product_id: string
  product_name: string
  sku: string | null
  hsn_code: string | null
  serial_number: string | null
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

export interface CreateInvoiceData {
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  payment_method: 'cash' | 'upi' | 'card'
  items: CreateInvoiceItem[]
}

export async function createInvoice(data: CreateInvoiceData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Verify stock for all items
  for (const item of data.items) {
    const { data: product, error } = await supabase
      .from('products')
      .select('current_stock, name')
      .eq('id', item.product_id)
      .single()
    if (error || !product) throw new Error(`Product not found: ${item.product_id}`)
    if (product.current_stock < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${product.current_stock}, Required: ${item.quantity}`)
    }
  }

  // 2. Get next invoice number atomically
  const { data: invoiceNoRow, error: seqError } = await supabase
    .rpc('next_invoice_no')
  if (seqError) throw new Error(`Invoice number generation failed: ${seqError.message}`)
  const invoice_no: string = invoiceNoRow

  // 3. Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_no,
      customer_id: data.customer_id,
      subtotal: data.subtotal,
      discount: data.discount,
      taxable_amount: data.taxable_amount,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      total_gst: data.total_gst,
      grand_total: data.grand_total,
      payment_method: data.payment_method,
      status: 'paid',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (invoiceError) throw new Error(invoiceError.message)
  const invoiceId = invoice.id

  // 4. Insert invoice items
  const itemRows = data.items.map(item => ({
    invoice_id: invoiceId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    hsn_code: item.hsn_code,
    serial_number: item.serial_number,
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
  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
  if (itemsError) throw new Error(itemsError.message)

  // 5. Deduct stock + log history for each item
  for (const item of data.items) {
    const { data: updated, error: stockError } = await supabase
      .from('products')
      .update({ current_stock: supabase.rpc as never })  // use increment below
      .eq('id', item.product_id)
      .select('current_stock')
      .single()

    // Use raw decrement
    const { data: prod, error: deductError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .single()
    if (deductError || !prod) throw new Error('Stock deduction failed')

    const newStock = prod.current_stock - item.quantity
    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', item.product_id)
    if (updateError) throw new Error(updateError.message)

    await supabase.from('stock_history').insert({
      product_id: item.product_id,
      change_type: 'sale',
      quantity_change: -item.quantity,
      quantity_after: newStock,
      reference_id: invoiceId,
      created_by: user.id,
    })

    // 6. Mark serial sold if applicable
    if (item.serial_number) {
      await supabase
        .from('product_serials')
        .update({ status: 'sold', invoice_id: invoiceId })
        .eq('product_id', item.product_id)
        .eq('serial_number', item.serial_number)
    }
  }

  revalidatePath('/invoices')
  revalidatePath('/products')
  revalidatePath('/stock-in')
  return invoiceId
}

export async function getInvoices(params?: {
  limit?: number
  status?: string
}): Promise<(Invoice & { customers: { name: string } | null })[]> {
  const supabase = await createClient()
  let query = supabase
    .from('invoices')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 100)

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as (Invoice & { customers: { name: string } | null })[]
}

export async function getInvoice(id: string): Promise<(Invoice & {
  customers: { name: string; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string } | null
  invoice_items: InvoiceItem[]
}) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(*), invoice_items(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as never
}
```

**Note:** The stock deduction code above has a minor redundancy — clean it up to:

```typescript
// Replace the stock deduction block (steps 5) with this cleaner version:
for (const item of data.items) {
  // Decrement stock
  const { data: prod } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', item.product_id)
    .single()
  const newStock = (prod?.current_stock ?? 0) - item.quantity
  await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', item.product_id)

  await supabase.from('stock_history').insert({
    product_id: item.product_id,
    change_type: 'sale',
    quantity_change: -item.quantity,
    quantity_after: newStock,
    reference_id: invoiceId,
    created_by: user.id,
  })

  if (item.serial_number) {
    await supabase
      .from('product_serials')
      .update({ status: 'sold', invoice_id: invoiceId })
      .eq('product_id', item.product_id)
      .eq('serial_number', item.serial_number)
  }
}
```

Write the clean version directly (no redundant lines).

- [ ] **Step 2: Commit**

```bash
git add actions/invoices.ts
git commit -m "feat: createInvoice server action — stock verify, insert, deduct, serial mark sold"
```

---

## Task 5: Billing Cart Types + Utilities

**Files:**
- Create: `components/billing/types.ts`

- [ ] **Step 1: Create `components/billing/types.ts`**

```typescript
import { calculateLineGST } from '@/lib/gst'
import type { Product } from '@/types/database'

export interface CartItem {
  _id: string  // client-only temp key (crypto.randomUUID())
  product: Product
  quantity: number
  rate: number         // selling price (editable)
  discount: number     // per-line discount in ₹
  serial_number: string | null  // required if product.serial_required
  // computed fields
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  total: number
}

export function recalcItem(item: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total'>, customerState: string): CartItem {
  const gst = calculateLineGST(
    { rate: item.rate, quantity: item.quantity, discount: item.discount, gst_rate: item.product.gst_rate },
    customerState
  )
  return { ...item, ...gst }
}

export function cartTotals(items: CartItem[]) {
  return {
    subtotal: items.reduce((s, i) => s + i.rate * i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discount, 0),
    taxable_amount: items.reduce((s, i) => s + i.taxable_amount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    total_gst: items.reduce((s, i) => s + i.total_gst, 0),
    grand_total: items.reduce((s, i) => s + i.total, 0),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/billing/types.ts
git commit -m "feat: billing cart types and recalc utilities"
```

---

## Task 6: Billing Sub-Components (ProductSearch, CartItemRow, SerialPicker)

**Files:**
- Create: `components/billing/ProductSearch.tsx`
- Create: `components/billing/CartItemRow.tsx`
- Create: `components/billing/SerialPicker.tsx`

- [ ] **Step 1: Create `components/billing/ProductSearch.tsx`**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { SearchIcon, CameraIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Product } from '@/types/database'

interface ProductSearchProps {
  products: Product[]
  onAdd: (product: Product) => void
}

export function ProductSearch({ products, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim().length >= 1
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()) ||
        (p.barcode ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  function handleSelect(product: Product) {
    if (product.status === 'inactive') {
      toast.error('Product is inactive.')
      return
    }
    if (product.current_stock <= 0) {
      toast.error(`"${product.name}" is out of stock.`)
      return
    }
    onAdd(product)
    setQuery('')
    inputRef.current?.focus()
  }

  async function startScan() {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      setScanning(true)
      const result = await reader.decodeOnceFromVideoDevice(undefined, videoRef.current!)
      const barcode = result.getText()
      const product = products.find(p => p.barcode === barcode || p.sku === barcode)
      if (product) {
        handleSelect(product)
        toast.success(`Scanned: ${product.name}`)
      } else {
        toast.error(`No product found for barcode: ${barcode}`)
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'No MultiFormat Readers were able to detect the code.') {
        toast.error('Scan failed. Try again.')
      }
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search product by name, SKU or barcode…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={startScan}
          className="h-10 w-10 flex items-center justify-center rounded-lg border border-input bg-background hover:bg-accent transition-colors"
          title="Scan barcode"
        >
          <CameraIcon className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Camera scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative rounded-xl overflow-hidden w-80 h-64 bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay />
            <button
              type="button"
              onClick={() => setScanning(false)}
              className="absolute top-2 right-2 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/40"
            >
              <XIcon className="size-4" />
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-32 border-2 border-white/60 rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Dropdown results */}
      {filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku} · Stock: {p.current_stock}</p>
              </div>
              <span className="shrink-0 ml-4 text-sm font-medium">₹{p.selling_price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/billing/CartItemRow.tsx`**

```typescript
'use client'

import { Trash2Icon } from 'lucide-react'
import type { CartItem } from './types'

interface CartItemRowProps {
  item: CartItem
  onQtyChange: (id: string, qty: number) => void
  onRateChange: (id: string, rate: number) => void
  onDiscountChange: (id: string, discount: number) => void
  onRemove: (id: string) => void
  onPickSerial: (id: string) => void
}

export function CartItemRow({ item, onQtyChange, onRateChange, onDiscountChange, onRemove, onPickSerial }: CartItemRowProps) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <p className="text-sm font-medium leading-tight">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">{item.product.sku}</p>
        {item.product.serial_required && (
          <button
            type="button"
            onClick={() => onPickSerial(item._id)}
            className={`mt-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
              item.serial_number
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {item.serial_number ? `S/N: ${item.serial_number}` : '⚠ Pick serial'}
          </button>
        )}
      </td>
      <td className="px-3 py-2 w-24">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQtyChange(item._id, Math.max(1, item.quantity - 1))}
            className="size-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent"
          >−</button>
          <input
            type="number"
            value={item.quantity}
            min={1}
            onChange={e => onQtyChange(item._id, Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 text-center text-sm border border-input rounded h-6 bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => onQtyChange(item._id, item.quantity + 1)}
            className="size-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent"
          >+</button>
        </div>
      </td>
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <input
            type="number"
            value={item.rate}
            min={0}
            step={0.01}
            onChange={e => onRateChange(item._id, parseFloat(e.target.value) || 0)}
            className="w-full pl-5 pr-2 py-1 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </td>
      <td className="px-3 py-2 w-24">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <input
            type="number"
            value={item.discount}
            min={0}
            step={0.01}
            onChange={e => onDiscountChange(item._id, parseFloat(e.target.value) || 0)}
            className="w-full pl-5 pr-2 py-1 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </td>
      <td className="px-3 py-2 w-20 text-right text-xs text-muted-foreground">
        {item.product.gst_rate}%
      </td>
      <td className="px-3 py-2 w-24 text-right">
        <p className="text-sm font-medium">₹{item.total.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">GST: ₹{item.total_gst.toFixed(2)}</p>
      </td>
      <td className="px-3 py-2 w-10">
        <button
          type="button"
          onClick={() => onRemove(item._id)}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2Icon className="size-4" />
        </button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 3: Create `components/billing/SerialPicker.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/database'

interface SerialPickerProps {
  product: Product
  onSelect: (serial: string) => void
  onClose: () => void
}

export function SerialPicker({ product, onSelect, onClose }: SerialPickerProps) {
  const [serials, setSerials] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('product_serials')
      .select('serial_number')
      .eq('product_id', product.id)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setSerials((data ?? []).map(r => r.serial_number))
        setLoading(false)
      })
  }, [product.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm mx-4 rounded-xl bg-background border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="font-medium text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">Select a serial number</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
          ) : serials.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No available serials.</p>
          ) : (
            serials.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(s)}
                className="w-full px-4 py-2.5 text-left text-sm font-mono hover:bg-accent transition-colors"
              >
                {s}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/billing/ProductSearch.tsx components/billing/CartItemRow.tsx components/billing/SerialPicker.tsx
git commit -m "feat: billing sub-components — ProductSearch, CartItemRow, SerialPicker"
```

---

## Task 7: Customer Selector + Cart Summary + Payment Modal

**Files:**
- Create: `components/billing/CustomerSelector.tsx`
- Create: `components/billing/CartSummary.tsx`
- Create: `components/billing/PaymentModal.tsx`

- [ ] **Step 1: Create `components/billing/CustomerSelector.tsx`**

```typescript
'use client'

import { useState, useMemo } from 'react'
import { UserIcon, SearchIcon, XIcon } from 'lucide-react'
import type { Customer } from '@/types/database'

interface CustomerSelectorProps {
  customers: Customer[]
  selected: Customer | null
  onSelect: (customer: Customer | null) => void
}

export function CustomerSelector({ customers, selected, onSelect }: CustomerSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 10)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.gstin ?? '').toLowerCase().includes(q)
    ).slice(0, 10)
  }, [customers, search])

  function handleSelect(c: Customer | null) {
    onSelect(c)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 rounded-lg border border-input bg-background px-3 h-10 text-sm hover:border-ring/50 transition-colors"
      >
        <UserIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className={selected ? 'flex-1 text-left font-medium truncate' : 'flex-1 text-left text-muted-foreground'}>
          {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}` : 'Walk-in customer'}
        </span>
        {selected && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleSelect(null) }}
            className="text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <SearchIcon className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors text-muted-foreground"
            >
              Walk-in (no customer)
            </button>
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone ?? ''} {c.state !== 'Telangana' ? `· ${c.state}` : ''}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/billing/CartSummary.tsx`**

```typescript
import { round2 } from '@/lib/gst'

interface CartSummaryProps {
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  itemCount: number
}

export function CartSummary({
  subtotal, discount, taxable_amount, cgst, sgst, igst, total_gst, grand_total, itemCount
}: CartSummaryProps) {
  const isIGST = igst > 0

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
        <span>₹{round2(subtotal).toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="text-emerald-600">−₹{round2(discount).toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between text-muted-foreground">
        <span>Taxable Amount</span>
        <span>₹{round2(taxable_amount).toFixed(2)}</span>
      </div>
      {isIGST ? (
        <div className="flex justify-between text-muted-foreground">
          <span>IGST</span>
          <span>₹{round2(igst).toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-muted-foreground">
            <span>CGST</span>
            <span>₹{round2(cgst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>SGST</span>
            <span>₹{round2(sgst).toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
        <span>Grand Total</span>
        <span>₹{round2(grand_total).toFixed(2)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/billing/PaymentModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { XIcon, BanknoteIcon, SmartphoneIcon, CreditCardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { round2 } from '@/lib/gst'

type PaymentMethod = 'cash' | 'upi' | 'card'

interface PaymentModalProps {
  grandTotal: number
  onConfirm: (method: PaymentMethod) => void
  onClose: () => void
  submitting: boolean
}

const METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <BanknoteIcon className="size-5" /> },
  { value: 'upi', label: 'UPI', icon: <SmartphoneIcon className="size-5" /> },
  { value: 'card', label: 'Card', icon: <CreditCardIcon className="size-5" /> },
]

export function PaymentModal({ grandTotal, onConfirm, onClose, submitting }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm mx-4 rounded-xl bg-background border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Confirm Payment</h2>
          <button type="button" onClick={onClose} disabled={submitting}>
            <XIcon className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">Total Amount</p>
            <p className="text-3xl font-bold mt-1">₹{round2(grandTotal).toFixed(2)}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={[
                    'flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-medium transition-colors',
                    method === m.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button
            className="w-full"
            onClick={() => onConfirm(method)}
            disabled={submitting}
          >
            {submitting ? 'Processing…' : `Confirm ${method.toUpperCase()} Payment`}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/billing/CustomerSelector.tsx components/billing/CartSummary.tsx components/billing/PaymentModal.tsx
git commit -m "feat: billing CustomerSelector, CartSummary, PaymentModal components"
```

---

## Task 8: BillingForm + Billing Page

**Files:**
- Create: `components/billing/BillingForm.tsx`
- Modify: `app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Create `components/billing/BillingForm.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Product, Customer } from '@/types/database'
import { type CartItem, recalcItem, cartTotals } from './types'
import { ProductSearch } from './ProductSearch'
import { CartItemRow } from './CartItemRow'
import { SerialPicker } from './SerialPicker'
import { CustomerSelector } from './CustomerSelector'
import { CartSummary } from './CartSummary'
import { PaymentModal } from './PaymentModal'
import { createInvoice } from '@/actions/invoices'
import { ShoppingCartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BillingFormProps {
  products: Product[]
  customers: Customer[]
}

export default function BillingForm({ products, customers }: BillingFormProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serialPickTarget, setSerialPickTarget] = useState<string | null>(null)  // _id of cart item
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const customerState = customer?.state ?? 'Telangana'

  function addProduct(product: Product) {
    setCart(prev => {
      // If already in cart (and no serial required), increment qty
      const existing = prev.find(i => i.product.id === product.id && !product.serial_required)
      if (existing) {
        return prev.map(i =>
          i._id === existing._id
            ? recalcItem({ ...i, quantity: i.quantity + 1 }, customerState)
            : i
        )
      }
      // New cart item
      const newItem: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total'> = {
        _id: crypto.randomUUID(),
        product,
        quantity: 1,
        rate: product.selling_price,
        discount: 0,
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

  function updateDiscount(id: string, discount: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount }, customerState) : i))
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i._id !== id))
  }

  function pickSerial(id: string) {
    setSerialPickTarget(id)
  }

  function handleSerialSelect(serial: string) {
    setCart(prev => prev.map(i => i._id === serialPickTarget ? { ...i, serial_number: serial } : i))
    setSerialPickTarget(null)
  }

  // Recompute all GST when customer state changes
  const handleCustomerChange = useCallback((c: Customer | null) => {
    setCustomer(c)
    const state = c?.state ?? 'Telangana'
    setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
  }, [])

  function handleCheckout() {
    if (cart.length === 0) {
      toast.error('Cart is empty.')
      return
    }
    const missing = cart.filter(i => i.product.serial_required && !i.serial_number)
    if (missing.length > 0) {
      toast.error(`Select serial numbers for: ${missing.map(i => i.product.name).join(', ')}`)
      return
    }
    setPaymentOpen(true)
  }

  async function handleConfirmPayment(method: 'cash' | 'upi' | 'card') {
    const totals = cartTotals(cart)
    setSubmitting(true)
    try {
      const invoiceId = await createInvoice({
        customer_id: customer?.id ?? null,
        ...totals,
        payment_method: method,
        items: cart.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          sku: i.product.sku,
          hsn_code: i.product.hsn_code,
          serial_number: i.serial_number,
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
      })
      toast.success('Invoice saved!')
      setPaymentOpen(false)
      router.push(`/invoices/${invoiceId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  const totals = cartTotals(cart)

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* LEFT: cart */}
      <div className="flex-1 min-w-0 space-y-4">
        <ProductSearch products={products} onAdd={addProduct} />

        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <ShoppingCartIcon className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Cart is empty. Search for a product to start billing.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rate</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Disc.</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">GST%</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <CartItemRow
                    key={item._id}
                    item={item}
                    onQtyChange={updateQty}
                    onRateChange={updateRate}
                    onDiscountChange={updateDiscount}
                    onRemove={removeItem}
                    onPickSerial={pickSerial}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RIGHT: customer + summary + checkout */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</p>
          <CustomerSelector
            customers={customers}
            selected={customer}
            onSelect={handleCustomerChange}
          />
          {customer && (
            <p className="text-xs text-muted-foreground px-1">
              State: {customer.state} → GST: {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
            </p>
          )}
        </div>

        <CartSummary {...totals} itemCount={cart.length} />

        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleCheckout}
          disabled={cart.length === 0 || submitting}
        >
          Proceed to Payment
        </Button>
      </div>

      {/* Serial picker modal */}
      {serialPickTarget && (() => {
        const item = cart.find(i => i._id === serialPickTarget)
        return item ? (
          <SerialPicker
            product={item.product}
            onSelect={handleSerialSelect}
            onClose={() => setSerialPickTarget(null)}
          />
        ) : null
      })()}

      {/* Payment modal */}
      {paymentOpen && (
        <PaymentModal
          grandTotal={totals.grand_total}
          onConfirm={handleConfirmPayment}
          onClose={() => setPaymentOpen(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace `app/(dashboard)/billing/page.tsx`**

```typescript
import { getProducts } from '@/actions/products'
import { getCustomers } from '@/actions/customers'
import BillingForm from '@/components/billing/BillingForm'

export default async function BillingPage() {
  const [products, customers] = await Promise.all([
    getProducts({ status: 'active' }),
    getCustomers(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          New Sale
        </h1>
        <p className="text-slate-500 text-sm mt-1">Scan or search products to build the cart</p>
      </div>
      <BillingForm products={products} customers={customers} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/billing/BillingForm.tsx app/\(dashboard\)/billing/page.tsx
git commit -m "feat: BillingForm — cart management, GST calc, serial picker, payment modal"
```

---

## Task 9: Invoice PDF

**Files:**
- Create: `components/invoices/InvoicePDF.tsx`
- Create: `app/api/invoices/[id]/pdf/route.ts`

- [ ] **Step 1: Create `components/invoices/InvoicePDF.tsx`**

```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { STORE } from '@/lib/store-constants'
import type { Invoice, InvoiceItem, Customer } from '@/types/database'
import { round2 } from '@/lib/gst'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', padding: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  storeName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  storeDetail: { fontSize: 8, color: '#64748b', marginTop: 2 },
  invoiceTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#2563eb', textAlign: 'right' },
  invoiceDetail: { fontSize: 8, color: '#64748b', textAlign: 'right', marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  billRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  billBox: { flex: 1 },
  billLabel: { fontSize: 7, color: '#94a3b8', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  billValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  billSub: { fontSize: 8, color: '#64748b', marginTop: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCell: { fontSize: 8 },
  col_no: { width: 20 },
  col_desc: { flex: 1 },
  col_hsn: { width: 52 },
  col_qty: { width: 28, textAlign: 'right' },
  col_rate: { width: 52, textAlign: 'right' },
  col_disc: { width: 40, textAlign: 'right' },
  col_taxable: { width: 55, textAlign: 'right' },
  col_gst: { width: 30, textAlign: 'right' },
  col_cgst: { width: 44, textAlign: 'right' },
  col_sgst: { width: 44, textAlign: 'right' },
  col_igst: { width: 44, textAlign: 'right' },
  col_total: { width: 56, textAlign: 'right' },
  totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalsBox: { width: 200 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: '#64748b' },
  totalValue: { fontSize: 8 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 2 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2563eb' },
  footer: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94a3b8' },
  gstnBadge: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  gstnText: { fontSize: 7, color: '#0369a1', fontFamily: 'Helvetica-Bold' },
})

interface InvoicePDFProps {
  invoice: Invoice
  items: InvoiceItem[]
  customer: Customer | null
}

export function InvoicePDF({ invoice, items, customer }: InvoicePDFProps) {
  const isIGST = invoice.igst > 0
  const isIntraState = !isIGST

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.storeName}>{STORE.name}</Text>
            <Text style={s.storeDetail}>{STORE.address}</Text>
            <Text style={s.storeDetail}>{STORE.city}</Text>
            <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
            <View style={[s.gstnBadge, { marginTop: 4, alignSelf: 'flex-start' }]}>
              <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
            </View>
          </View>
          <View>
            <Text style={s.invoiceTitle}>TAX INVOICE</Text>
            <Text style={s.invoiceDetail}>Invoice No: {invoice.invoice_no}</Text>
            <Text style={s.invoiceDetail}>Date: {new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
            <Text style={s.invoiceDetail}>Payment: {invoice.payment_method?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Bill To */}
        <View style={s.billRow}>
          <View style={s.billBox}>
            <Text style={s.billLabel}>Bill To</Text>
            <Text style={s.billValue}>{customer ? customer.name : 'Walk-in Customer'}</Text>
            {customer?.phone && <Text style={s.billSub}>Ph: {customer.phone}</Text>}
            {customer?.address && <Text style={s.billSub}>{customer.address}</Text>}
            {customer?.gstin && <Text style={s.billSub}>GSTIN: {customer.gstin}</Text>}
            {customer && <Text style={s.billSub}>State: {customer.state}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        {/* Items table */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.col_no]}>#</Text>
          <Text style={[s.tableHeaderCell, s.col_desc]}>Description</Text>
          <Text style={[s.tableHeaderCell, s.col_hsn]}>HSN</Text>
          <Text style={[s.tableHeaderCell, s.col_qty]}>Qty</Text>
          <Text style={[s.tableHeaderCell, s.col_rate]}>Rate</Text>
          <Text style={[s.tableHeaderCell, s.col_disc]}>Disc.</Text>
          <Text style={[s.tableHeaderCell, s.col_taxable]}>Taxable</Text>
          <Text style={[s.tableHeaderCell, s.col_gst]}>GST%</Text>
          {isIntraState ? (
            <>
              <Text style={[s.tableHeaderCell, s.col_cgst]}>CGST</Text>
              <Text style={[s.tableHeaderCell, s.col_sgst]}>SGST</Text>
            </>
          ) : (
            <Text style={[s.tableHeaderCell, s.col_igst]}>IGST</Text>
          )}
          <Text style={[s.tableHeaderCell, s.col_total]}>Total</Text>
        </View>

        {items.map((item, i) => (
          <View key={item.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}]}>
            <Text style={[s.tableCell, s.col_no]}>{i + 1}</Text>
            <View style={s.col_desc}>
              <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{item.product_name}</Text>
              {item.sku && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>{item.sku}</Text>}
              {item.serial_number && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>S/N: {item.serial_number}</Text>}
            </View>
            <Text style={[s.tableCell, s.col_hsn]}>{item.hsn_code ?? '—'}</Text>
            <Text style={[s.tableCell, s.col_qty]}>{item.quantity}</Text>
            <Text style={[s.tableCell, s.col_rate]}>₹{round2(item.rate).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_disc]}>₹{round2(item.discount).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_taxable]}>₹{round2(item.taxable_amount).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_gst]}>{item.gst_rate}%</Text>
            {isIntraState ? (
              <>
                <Text style={[s.tableCell, s.col_cgst]}>₹{round2(item.cgst).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_sgst]}>₹{round2(item.sgst).toFixed(2)}</Text>
              </>
            ) : (
              <Text style={[s.tableCell, s.col_igst]}>₹{round2(item.igst).toFixed(2)}</Text>
            )}
            <Text style={[s.tableCell, s.col_total, { fontFamily: 'Helvetica-Bold' }]}>₹{round2(item.total).toFixed(2)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>₹{round2(invoice.subtotal).toFixed(2)}</Text>
            </View>
            {invoice.discount > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Discount</Text>
                <Text style={[s.totalValue, { color: '#16a34a' }]}>−₹{round2(invoice.discount).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Taxable Amount</Text>
              <Text style={s.totalValue}>₹{round2(invoice.taxable_amount).toFixed(2)}</Text>
            </View>
            {isIntraState ? (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>CGST</Text>
                  <Text style={s.totalValue}>₹{round2(invoice.cgst).toFixed(2)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>SGST</Text>
                  <Text style={s.totalValue}>₹{round2(invoice.sgst).toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>IGST</Text>
                <Text style={s.totalValue}>₹{round2(invoice.igst).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>₹{round2(invoice.grand_total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>This is a computer-generated invoice. No signature required.</Text>
          <Text style={s.footerText}>{STORE.name} · GSTIN: {STORE.gstin}</Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Create `app/api/invoices/[id]/pdf/route.ts`**

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { getInvoice } from '@/actions/invoices'
import { InvoicePDF } from '@/components/invoices/InvoicePDF'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  const buffer = await renderToBuffer(
    createElement(InvoicePDF, {
      invoice,
      items: invoice.invoice_items ?? [],
      customer: invoice.customers ?? null,
    })
  )

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_no}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/invoices/InvoicePDF.tsx app/api/
git commit -m "feat: A4 GST invoice PDF via @react-pdf/renderer + /api/invoices/[id]/pdf route"
```

---

## Task 10: Invoice List + Detail Pages

**Files:**
- Modify: `app/(dashboard)/invoices/page.tsx`
- Create: `app/(dashboard)/invoices/[id]/page.tsx`

- [ ] **Step 1: Replace `app/(dashboard)/invoices/page.tsx`**

```typescript
import Link from 'next/link'
import { getInvoices } from '@/actions/invoices'
import { format } from 'date-fns'

export default async function InvoicesPage() {
  const invoices = await getInvoices({ limit: 100 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Invoices
        </h1>
        <p className="text-slate-500 text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Link href="/billing" className="mt-4 inline-block text-sm text-primary hover:underline">
            Start billing →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-primary hover:underline">
                      {inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.customers?.name ?? 'Walk-in'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(inv.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-full">
                      {inv.payment_method ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₹{inv.grand_total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inv.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : inv.status === 'cancelled'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {inv.status}
                    </span>
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

- [ ] **Step 2: Create `app/(dashboard)/invoices/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/actions/invoices'
import { InvoiceShareButtons } from '@/components/invoices/InvoiceShareButtons'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()

  const customer = invoice.customers
  const items = invoice.invoice_items ?? []
  const isIGST = invoice.igst > 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeftIcon className="size-3.5" /> Invoices
          </Link>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {invoice.invoice_no}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(invoice.created_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>
        <InvoiceShareButtons
          invoiceId={invoice.id}
          invoiceNo={invoice.invoice_no}
          grandTotal={invoice.grand_total}
          customerEmail={customer?.email ?? null}
          customerPhone={customer?.phone ?? null}
        />
      </div>

      {/* Customer info */}
      <div className="rounded-xl border border-border p-4 text-sm space-y-1">
        <p className="font-medium">{customer ? customer.name : 'Walk-in Customer'}</p>
        {customer?.phone && <p className="text-muted-foreground">Ph: {customer.phone}</p>}
        {customer?.address && <p className="text-muted-foreground">{customer.address}</p>}
        {customer?.gstin && <p className="text-muted-foreground font-mono text-xs">GSTIN: {customer.gstin}</p>}
        <p className="text-muted-foreground text-xs">
          Payment: <span className="capitalize font-medium text-foreground">{invoice.payment_method}</span>
          {' · '}Status: <span className={`font-medium ${invoice.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>{invoice.status}</span>
        </p>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
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
                  {item.serial_number && <p className="text-xs text-muted-foreground font-mono">S/N: {item.serial_number}</p>}
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
            <span>Subtotal</span><span>₹{round2(invoice.subtotal).toFixed(2)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span><span className="text-emerald-600">−₹{round2(invoice.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable Amount</span><span>₹{round2(invoice.taxable_amount).toFixed(2)}</span>
          </div>
          {isIGST ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span><span>₹{round2(invoice.igst).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span><span>₹{round2(invoice.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span><span>₹{round2(invoice.sgst).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span><span>₹{round2(invoice.grand_total).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/invoices/
git commit -m "feat: invoice list and detail pages"
```

---

## Task 11: Share — WhatsApp + Email

**Files:**
- Create: `actions/send-invoice-email.ts`
- Create: `components/invoices/InvoiceShareButtons.tsx`

- [ ] **Step 1: Create `actions/send-invoice-email.ts`**

```typescript
'use server'

import { Resend } from 'resend'
import { getInvoice } from './invoices'
import { STORE } from '@/lib/store-constants'
import { round2 } from '@/lib/gst'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvoiceEmail(invoiceId: string, toEmail: string): Promise<void> {
  const invoice = await getInvoice(invoiceId)
  if (!invoice) throw new Error('Invoice not found')

  const customer = invoice.customers
  const items = invoice.invoice_items ?? []
  const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/invoices/${invoiceId}/pdf`

  const itemsHtml = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="padding:6px 8px">${item.product_name}${item.serial_number ? `<br><small style="color:#94a3b8">S/N: ${item.serial_number}</small>` : ''}</td>
      <td style="padding:6px 8px;text-align:center">${item.quantity}</td>
      <td style="padding:6px 8px;text-align:right">₹${round2(item.rate).toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600">₹${round2(item.total).toFixed(2)}</td>
    </tr>
  `).join('')

  const { error } = await resend.emails.send({
    from: `${STORE.name} <invoices@resend.dev>`,
    to: [toEmail],
    subject: `Invoice ${invoice.invoice_no} from ${STORE.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#2563eb;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">${STORE.name}</h1>
          <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${STORE.address}, ${STORE.city}</p>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;font-size:18px">TAX INVOICE</h2>
          <p style="margin:0;color:#64748b;font-size:13px">Invoice No: <strong>${invoice.invoice_no}</strong> · Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}</p>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px">Bill To: <strong>${customer ? customer.name : 'Walk-in Customer'}</strong></p>

          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase">Product</th>
                <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">Qty</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">Rate</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div style="margin-top:16px;text-align:right;font-size:13px">
            <p style="margin:2px 0;color:#64748b">Taxable Amount: ₹${round2(invoice.taxable_amount).toFixed(2)}</p>
            <p style="margin:2px 0;color:#64748b">Total GST: ₹${round2(invoice.total_gst).toFixed(2)}</p>
            <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#2563eb">Grand Total: ₹${round2(invoice.grand_total).toFixed(2)}</p>
          </div>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            <a href="${pdfUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
              Download PDF Invoice
            </a>
          </div>

          <p style="margin-top:16px;font-size:11px;color:#94a3b8">GSTIN: ${STORE.gstin} · ${STORE.phone}</p>
        </div>
      </div>
    `,
  })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `components/invoices/InvoiceShareButtons.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { DownloadIcon, MessageCircleIcon, MailIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { sendInvoiceEmail } from '@/actions/send-invoice-email'
import { Button } from '@/components/ui/button'
import { round2 } from '@/lib/gst'

interface InvoiceShareButtonsProps {
  invoiceId: string
  invoiceNo: string
  grandTotal: number
  customerEmail: string | null
  customerPhone: string | null
}

export function InvoiceShareButtons({
  invoiceId, invoiceNo, grandTotal, customerEmail, customerPhone
}: InvoiceShareButtonsProps) {
  const [emailSending, setEmailSending] = useState(false)

  function handleDownload() {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Dear Customer,\n\nThank you for your purchase.\n\nInvoice: *${invoiceNo}*\nAmount: *₹${round2(grandTotal).toFixed(2)}*\n\nDownload your invoice: ${window.location.origin}/api/invoices/${invoiceId}/pdf\n\nDubai Shoppe`
    )
    const phone = customerPhone?.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${phone ? `91${phone}` : ''}?text=${msg}`, '_blank')
  }

  async function handleEmail() {
    if (!customerEmail) {
      toast.error('No email on record for this customer.')
      return
    }
    setEmailSending(true)
    try {
      await sendInvoiceEmail(invoiceId, customerEmail)
      toast.success(`Invoice emailed to ${customerEmail}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email failed.')
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <DownloadIcon className="size-4 mr-1.5" />PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleWhatsApp}>
        <MessageCircleIcon className="size-4 mr-1.5" />WhatsApp
      </Button>
      <Button variant="outline" size="sm" onClick={handleEmail} disabled={emailSending || !customerEmail}>
        {emailSending ? <Loader2Icon className="size-4 mr-1.5 animate-spin" /> : <MailIcon className="size-4 mr-1.5" />}
        Email
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Add `NEXT_PUBLIC_APP_URL` to `.env.local`**

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add actions/send-invoice-email.ts components/invoices/InvoiceShareButtons.tsx
git commit -m "feat: invoice sharing — WhatsApp link + Resend email + PDF download"
```

---

## Task 12: Lint + Type Check + Build Verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: 0 errors. Fix any if found.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Fix any TypeScript errors found.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: ✓ Compiled successfully. Fix any build errors.

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: lint and type errors from Phase 1D"
```

---

## Task 13: Playwright E2E Test

**Files:**
- Create: `tests/e2e/billing.spec.ts`

- [ ] **Step 1: Create the test**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Billing — unauthenticated redirect', () => {
  test('billing page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/billing')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })

  test('invoices page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })

  test('customers page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- tests/e2e/billing.spec.ts
```

Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/billing.spec.ts
git commit -m "test: Phase 1D smoke tests — billing/invoices/customers redirect"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Billing screen with cart, product search, barcode scan
- ✅ Walk-in + saved customer selection
- ✅ GST auto-calc (CGST+SGST for Telangana, IGST for other states)
- ✅ Cash/UPI/Card payment methods
- ✅ Serial number selection for serial-required products
- ✅ Stock verification before save
- ✅ Stock deduction after invoice save
- ✅ A4 GST invoice PDF
- ✅ WhatsApp sharing
- ✅ Email sharing via Resend
- ✅ Invoice list page
- ✅ Invoice detail page
- ✅ Customer CRUD
- ✅ Invoice number: INV-000001 format (Postgres sequence)
- ✅ Lint + typecheck + build verification

**Notes for implementer:**
1. Task 1 SQL must be run in Supabase before any billing can work
2. `NEXT_PUBLIC_APP_URL` must be in `.env.local` for email PDF link to work
3. The stock deduction in `createInvoice` is NOT atomic — if the server crashes mid-way, stock could be inconsistent. For production hardening, wrap in a Postgres stored procedure. For now this is acceptable.
4. Email from address `invoices@resend.dev` is Resend's sandbox domain — only works for verified addresses in test mode. Production requires a custom domain in Resend.
