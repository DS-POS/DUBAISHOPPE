# Products Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Products module for DS POS — list, add, edit, delete, barcode display, image upload, and category management.

**Architecture:** Server Actions handle all mutations (create/update/delete) with `revalidatePath`. The products list page is a Server Component that fetches data server-side; interactive UI (form, search, barcode modal) are Client Components. Image uploads go directly to Supabase Storage `product-images` bucket.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn base-nova (@base-ui/react), Supabase PostgreSQL + Storage, react-hook-form + zod, react-barcode, sonner (toasts), Server Actions

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `actions/categories.ts` | Create | Server actions: getCategories, createCategory, deleteCategory |
| `actions/products.ts` | Create | Server actions: getProducts, getProduct, createProduct, updateProduct, deleteProduct |
| `components/products/BarcodeModal.tsx` | Create | Client: Dialog showing barcode + print button |
| `components/products/ProductForm.tsx` | Create | Client: react-hook-form + zod form for create/edit |
| `components/products/ProductSearch.tsx` | Create | Client: search input + filter controls (category, status) |
| `components/products/ProductsTable.tsx` | Create | Client: products table rows with actions |
| `app/(dashboard)/products/page.tsx` | Replace | Server: stats, fetch products, render table + search |
| `app/(dashboard)/products/new/page.tsx` | Create | Server: render ProductForm in create mode |
| `app/(dashboard)/products/[id]/edit/page.tsx` | Create | Server: fetch product, render ProductForm in edit mode |

---

### Task 1: Category Server Actions

**Files:**
- Create: `actions/categories.ts`

- [ ] **Step 1: Create the file with all three category actions**

```typescript
// actions/categories.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Category } from '@/types/database'

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCategory(name: string): Promise<Category> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim() })
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check no products reference this category
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if ((count ?? 0) > 0) throw new Error('Cannot delete category with existing products')

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
}
```

- [ ] **Step 2: Verify TypeScript compiles (quick check)**

```powershell
cd "C:\Users\PC\Desktop\DS POS"
npx tsc --noEmit --skipLibCheck 2>&1 | Select-Object -First 20
```

Expected: No errors for `actions/categories.ts`. (Other unrelated errors from not-yet-created files are fine at this stage.)

- [ ] **Step 3: Commit**

```bash
git add actions/categories.ts
git commit -m "feat: add category server actions (getCategories, createCategory, deleteCategory)"
```

---

### Task 2: Product Server Actions

**Files:**
- Create: `actions/products.ts`

- [ ] **Step 1: Create the file**

```typescript
// actions/products.ts
// SETUP REQUIRED: Create 'product-images' bucket in Supabase Dashboard
// Storage → New Bucket → Name: product-images → Public: ON

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Product } from '@/types/database'

export interface ProductFormData {
  name: string
  sku: string
  barcode?: string
  category_id?: string
  brand?: string
  cost_price: number
  selling_price: number
  gst_rate: number
  hsn_code?: string
  low_stock_alert: number
  serial_required: boolean
  status: 'active' | 'inactive'
  image_url?: string
}

export async function getProducts(params?: {
  search?: string
  categoryId?: string
  status?: 'active' | 'inactive'
}): Promise<Product[]> {
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*, categories(id, name, created_at)')
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }
  if (params?.categoryId) {
    query = query.eq('category_id', params.categoryId)
  }
  if (params?.search) {
    query = query.or(
      `name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.ilike.%${params.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Product[]
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(id, name, created_at)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Product
}

export async function createProduct(formData: ProductFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // If no barcode, use SKU as barcode value
  const barcode = formData.barcode?.trim() || formData.sku

  const { error } = await supabase.from('products').insert({
    name: formData.name,
    sku: formData.sku,
    barcode,
    category_id: formData.category_id || null,
    brand: formData.brand || null,
    cost_price: formData.cost_price,
    selling_price: formData.selling_price,
    gst_rate: formData.gst_rate,
    hsn_code: formData.hsn_code || null,
    low_stock_alert: formData.low_stock_alert,
    serial_required: formData.serial_required,
    status: formData.status,
    image_url: formData.image_url || null,
    current_stock: 0,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  redirect('/products')
}

export async function updateProduct(id: string, formData: ProductFormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const barcode = formData.barcode?.trim() || formData.sku

  const { error } = await supabase
    .from('products')
    .update({
      name: formData.name,
      sku: formData.sku,
      barcode,
      category_id: formData.category_id || null,
      brand: formData.brand || null,
      cost_price: formData.cost_price,
      selling_price: formData.selling_price,
      gst_rate: formData.gst_rate,
      hsn_code: formData.hsn_code || null,
      low_stock_alert: formData.low_stock_alert,
      serial_required: formData.serial_required,
      status: formData.status,
      image_url: formData.image_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
  redirect('/products')
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Soft delete: set status to inactive (admin only — caller must enforce role)
  const { error } = await supabase
    .from('products')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/products')
}
```

- [ ] **Step 2: Commit**

```bash
git add actions/products.ts
git commit -m "feat: add product server actions (CRUD + getProducts/getProduct)"
```

---

### Task 3: BarcodeModal Component

**Files:**
- Create: `components/products/BarcodeModal.tsx`

- [ ] **Step 1: Create the BarcodeModal client component**

```typescript
// components/products/BarcodeModal.tsx
'use client'

import React, { useRef } from 'react'
import Barcode from 'react-barcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PrinterIcon } from 'lucide-react'

interface BarcodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  sku: string
  barcode: string
  sellingPrice: number
}

export function BarcodeModal({
  open,
  onOpenChange,
  productName,
  sku,
  barcode,
  sellingPrice,
}: BarcodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const printContent = printRef.current
    if (!printContent) return

    const originalBody = document.body.innerHTML
    document.body.innerHTML = `
      <html><head>
        <title>Barcode - ${productName}</title>
        <style>
          body { display: flex; justify-content: center; align-items: center; padding: 20px; font-family: sans-serif; }
          .barcode-print { text-align: center; }
          .barcode-print h3 { font-size: 14px; margin-bottom: 4px; }
          .barcode-print p { font-size: 12px; margin: 2px 0; color: #555; }
        </style>
      </head><body>${printContent.outerHTML}</body></html>
    `
    window.print()
    document.body.innerHTML = originalBody
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Rubik, sans-serif' }}>
            Product Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div ref={printRef} className="barcode-print text-center">
            <h3 className="font-semibold text-sm text-[#0F172A] truncate max-w-[250px]">
              {productName}
            </h3>
            <p className="text-xs text-slate-500">SKU: {sku}</p>
            <div className="my-2">
              <Barcode
                value={barcode}
                width={1.5}
                height={60}
                fontSize={12}
                displayValue={true}
              />
            </div>
            <p className="text-sm font-semibold text-[#0369A1]">
              ₹{sellingPrice.toFixed(2)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-[#0369A1] hover:bg-[#0369A1]/90 text-white"
          >
            <PrinterIcon className="size-4 mr-1" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/products/BarcodeModal.tsx
git commit -m "feat: add BarcodeModal component with print support"
```

---

### Task 4: ProductForm Component

**Files:**
- Create: `components/products/ProductForm.tsx`

This is the largest component. It handles create and edit modes, image upload to Supabase Storage, auto-SKU generation, barcode preview, and inline category creation.

- [ ] **Step 1: Create the ProductForm client component**

```typescript
// components/products/ProductForm.tsx
'use client'

import React, { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import Barcode from 'react-barcode'
import { Loader2Icon, RefreshCwIcon, ImageIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { createProduct, updateProduct } from '@/actions/products'
import { createCategory } from '@/actions/categories'
import type { Category, Product } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  category_id: z.string().optional(),
  brand: z.string().optional(),
  cost_price: z.coerce.number().min(0, 'Cost price must be 0 or more'),
  selling_price: z.coerce.number().min(0, 'Selling price must be 0 or more'),
  gst_rate: z.coerce.number(),
  hsn_code: z.string().optional(),
  low_stock_alert: z.coerce.number().min(0).default(5),
  serial_required: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
  mode: 'create' | 'edit'
  product?: Product
  categories: Category[]
}

export function ProductForm({ mode, product, categories: initialCategories }: ProductFormProps) {
  const [isPending, startTransition] = useTransition()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>(product?.image_url ?? '')
  const [imageUploading, setImageUploading] = useState(false)
  const [barcodePreview, setBarcodePreview] = useState<string>(product?.barcode ?? '')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      category_id: product?.category_id ?? '',
      brand: product?.brand ?? '',
      cost_price: product?.cost_price ?? 0,
      selling_price: product?.selling_price ?? 0,
      gst_rate: product?.gst_rate ?? 18,
      hsn_code: product?.hsn_code ?? '',
      low_stock_alert: product?.low_stock_alert ?? 5,
      serial_required: product?.serial_required ?? false,
      status: product?.status ?? 'active',
    },
  })

  const watchedBarcode = watch('barcode')
  const watchedSku = watch('sku')

  // Update barcode preview when barcode or SKU changes
  React.useEffect(() => {
    const val = watchedBarcode?.trim() || watchedSku?.trim()
    setBarcodePreview(val ?? '')
  }, [watchedBarcode, watchedSku])

  function generateSKU() {
    const categoryPrefix = categories.find(c => c.id === watch('category_id'))?.name?.slice(0, 3).toUpperCase() ?? 'GEN'
    const timestamp = Date.now().toString().slice(-4)
    const sku = `${categoryPrefix}-${timestamp}`
    setValue('sku', sku)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setImageUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      setImageUrl(urlData.publicUrl)
      toast.success('Image uploaded')
    } catch (err) {
      toast.error('Image upload failed')
      console.error(err)
    } finally {
      setImageUploading(false)
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    setIsAddingCategory(true)
    try {
      const created = await createCategory(newCategoryName.trim())
      setCategories(prev => [...prev, created])
      setValue('category_id', created.id)
      setNewCategoryName('')
      setShowAddCategory(false)
      toast.success(`Category "${created.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setIsAddingCategory(false)
    }
  }

  function onSubmit(values: ProductFormValues) {
    startTransition(async () => {
      try {
        const payload = {
          ...values,
          image_url: imageUrl || undefined,
          category_id: values.category_id || undefined,
          barcode: values.barcode || undefined,
          brand: values.brand || undefined,
          hsn_code: values.hsn_code || undefined,
        }

        if (mode === 'edit' && product) {
          await updateProduct(product.id, payload)
          toast.success('Product updated')
        } else {
          await createProduct(payload)
          toast.success('Product created')
        }
      } catch (err) {
        // redirect() throws a special Next.js error - don't catch it as real error
        const message = err instanceof Error ? err.message : 'Something went wrong'
        if (!message.includes('NEXT_REDIRECT')) {
          toast.error(message)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-[#0F172A] mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...register('name')} placeholder="e.g. Canon EOS R50" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" {...register('brand')} placeholder="e.g. Canon" />
          </div>

          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="sku">SKU <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input id="sku" {...register('sku')} placeholder="e.g. CAM-001" className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSKU}
                title="Auto-generate SKU"
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          {/* Barcode */}
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" {...register('barcode')} placeholder="Auto-generated from SKU if empty" />
            <p className="text-xs text-muted-foreground">Leave empty to use SKU as barcode</p>
          </div>

          {/* Category */}
          <div className="space-y-2 md:col-span-2">
            <Label>Category</Label>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={watch('category_id') ?? ''}
                onValueChange={(val) => setValue('category_id', val)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!showAddCategory ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCategory(true)}
                >
                  + New Category
                </Button>
              ) : (
                <div className="flex gap-2 items-center">
                  <Input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="w-40"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
                    onClick={handleAddCategory}
                    disabled={isAddingCategory}
                  >
                    {isAddingCategory ? <Loader2Icon className="size-4 animate-spin" /> : 'Add'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Pricing */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-[#0F172A] mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Pricing & Tax
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cost_price">Cost Price (₹) <span className="text-destructive">*</span></Label>
            <Input id="cost_price" type="number" step="0.01" min="0" {...register('cost_price')} />
            {errors.cost_price && <p className="text-xs text-destructive">{errors.cost_price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="selling_price">Selling Price (₹) <span className="text-destructive">*</span></Label>
            <Input id="selling_price" type="number" step="0.01" min="0" {...register('selling_price')} />
            {errors.selling_price && <p className="text-xs text-destructive">{errors.selling_price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>GST Rate <span className="text-destructive">*</span></Label>
            <Select
              value={String(watch('gst_rate'))}
              onValueChange={(val) => setValue('gst_rate', Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select GST rate" />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 12, 18, 28].map(rate => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hsn_code">HSN Code</Label>
            <Input id="hsn_code" {...register('hsn_code')} placeholder="e.g. 8525" />
          </div>
        </div>
      </Card>

      {/* Inventory */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-[#0F172A] mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Inventory & Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="low_stock_alert">Low Stock Alert Threshold</Label>
            <Input id="low_stock_alert" type="number" min="0" {...register('low_stock_alert')} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(val) => setValue('status', val as 'active' | 'inactive')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Serial Number Required</Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="serial_required"
                type="checkbox"
                {...register('serial_required')}
                className="h-4 w-4 rounded border-border accent-[#0369A1]"
              />
              <label htmlFor="serial_required" className="text-sm text-slate-600">
                Track individual serial numbers
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Image Upload */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-[#0F172A] mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Product Image
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Preview */}
          <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-slate-50 shrink-0 overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="Product" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_upload">Upload Image</Label>
            <Input
              id="image_upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={imageUploading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, WebP.</p>
            {imageUploading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2Icon className="size-4 animate-spin" />
                Uploading...
              </div>
            )}
            {imageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImageUrl('')}
                className="text-destructive"
              >
                Remove Image
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Barcode Preview */}
      {barcodePreview && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[#0F172A] mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Barcode Preview
          </h2>
          <div className="flex justify-center">
            <Barcode value={barcodePreview} width={1.5} height={60} fontSize={12} />
          </div>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 justify-end pb-6">
        <Link href="/products">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={isPending || imageUploading}
          className="bg-[#0369A1] text-white hover:bg-[#0369A1]/90 min-w-[120px]"
        >
          {isPending ? (
            <><Loader2Icon className="size-4 animate-spin mr-2" /> Saving...</>
          ) : mode === 'create' ? 'Create Product' : 'Update Product'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/products/ProductForm.tsx
git commit -m "feat: add ProductForm client component with image upload and barcode preview"
```

---

### Task 5: ProductSearch Component (Client)

**Files:**
- Create: `components/products/ProductSearch.tsx`

This component manages client-side search state and emits filter changes up to the parent table.

- [ ] **Step 1: Create the ProductSearch component**

```typescript
// components/products/ProductSearch.tsx
'use client'

import React from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category } from '@/types/database'

interface ProductSearchProps {
  categories: Category[]
  onSearchChange: (search: string) => void
  onCategoryChange: (categoryId: string) => void
  onStatusChange: (status: string) => void
  searchValue: string
  categoryValue: string
  statusValue: string
}

export function ProductSearch({
  categories,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  searchValue,
  categoryValue,
  statusValue,
}: ProductSearchProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, barcode..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Category filter */}
      <Select value={categoryValue} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusValue} onValueChange={onStatusChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/products/ProductSearch.tsx
git commit -m "feat: add ProductSearch filter component"
```

---

### Task 6: ProductsTable Component (Client)

**Files:**
- Create: `components/products/ProductsTable.tsx`

This wraps the table + search state management + BarcodeModal. It's a client component so it can manage filter state and open the modal.

- [ ] **Step 1: Create ProductsTable component**

```typescript
// components/products/ProductsTable.tsx
'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  EditIcon,
  BarcodeIcon,
  Trash2Icon,
  PackageIcon,
  AlertTriangleIcon,
} from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { deleteProduct } from '@/actions/products'
import { BarcodeModal } from './BarcodeModal'
import { ProductSearch } from './ProductSearch'
import type { Product, Category } from '@/types/database'

interface ProductsTableProps {
  products: Product[]
  categories: Category[]
  userRole: string
}

export function ProductsTable({ products, categories, userRole }: ProductsTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [barcodeModal, setBarcodeModal] = useState<{
    open: boolean
    product: Product | null
  }>({ open: false, product: null })
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCategory =
        categoryFilter === 'all' || p.category_id === categoryFilter

      const matchStatus =
        statusFilter === 'all' || p.status === statusFilter

      return matchSearch && matchCategory && matchStatus
    })
  }, [products, search, categoryFilter, statusFilter])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Mark "${name}" as inactive?`)) return
    setDeleting(id)
    try {
      await deleteProduct(id)
      toast.success(`"${name}" marked inactive`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const isAdmin = userRole === 'admin'

  return (
    <div className="space-y-4">
      <ProductSearch
        categories={categories}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryFilter}
        onStatusChange={setStatusFilter}
        searchValue={search}
        categoryValue={categoryFilter}
        statusValue={statusFilter}
      />

      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Name / SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price (₹)</TableHead>
              <TableHead className="text-center">GST</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageIcon className="size-10 opacity-30" />
                    <p className="font-medium">No products found</p>
                    <p className="text-sm">
                      {search || categoryFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Add your first product to get started'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(product => {
                const isLowStock = product.current_stock <= product.low_stock_alert
                return (
                  <TableRow key={product.id} className="hover:bg-slate-50/50">
                    {/* Image */}
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <PackageIcon className="size-5 text-slate-400" />
                        )}
                      </div>
                    </TableCell>

                    {/* Name / SKU */}
                    <TableCell>
                      <div>
                        <p className="font-medium text-[#0F172A] text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{product.sku}</p>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {product.categories?.name ?? '—'}
                      </span>
                    </TableCell>

                    {/* Stock */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isLowStock && product.status === 'active' && (
                          <AlertTriangleIcon className="size-3.5 text-amber-500 shrink-0" />
                        )}
                        <span
                          className={
                            isLowStock && product.status === 'active'
                              ? 'font-semibold text-amber-600'
                              : 'text-sm text-slate-700'
                          }
                        >
                          {product.current_stock}
                        </span>
                      </div>
                      {isLowStock && product.status === 'active' && (
                        <p className="text-xs text-amber-500 text-right">Low stock</p>
                      )}
                    </TableCell>

                    {/* Price */}
                    <TableCell className="text-right">
                      <span className="font-medium text-sm">
                        ₹{product.selling_price.toFixed(2)}
                      </span>
                    </TableCell>

                    {/* GST */}
                    <TableCell className="text-center">
                      <span className="text-sm text-slate-600">{product.gst_rate}%</span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge
                        variant={product.status === 'active' ? 'default' : 'secondary'}
                        className={
                          product.status === 'active'
                            ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20'
                            : ''
                        }
                      >
                        {product.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Barcode */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="View barcode"
                          onClick={() => setBarcodeModal({ open: true, product })}
                        >
                          <BarcodeIcon className="size-4" />
                        </Button>

                        {/* Edit */}
                        <Link href={`/products/${product.id}/edit`}>
                          <Button variant="ghost" size="icon-sm" title="Edit product">
                            <EditIcon className="size-4" />
                          </Button>
                        </Link>

                        {/* Delete (admin only) */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Deactivate product"
                            onClick={() => handleDelete(product.id, product.name)}
                            disabled={deleting === product.id || product.status === 'inactive'}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Barcode Modal */}
      {barcodeModal.product && (
        <BarcodeModal
          open={barcodeModal.open}
          onOpenChange={open => setBarcodeModal(prev => ({ ...prev, open }))}
          productName={barcodeModal.product.name}
          sku={barcodeModal.product.sku}
          barcode={barcodeModal.product.barcode ?? barcodeModal.product.sku}
          sellingPrice={barcodeModal.product.selling_price}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/products/ProductsTable.tsx
git commit -m "feat: add ProductsTable with search, filters, barcode modal, low-stock highlighting"
```

---

### Task 7: Products List Page (Server Component)

**Files:**
- Replace: `app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Replace the placeholder page with the real server component**

```typescript
// app/(dashboard)/products/page.tsx
import Link from 'next/link'
import { PlusIcon, PackageIcon, CheckCircleIcon, AlertTriangleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductsTable } from '@/components/products/ProductsTable'

import { getProducts } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const [products, categories, supabase] = await Promise.all([
    getProducts(),
    getCategories(),
    createClient(),
  ])

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .single()

  const userRole = profile?.role ?? 'staff'
  const activeCount = products.filter(p => p.status === 'active').length
  const lowStockCount = products.filter(
    p => p.current_stock <= p.low_stock_alert && p.status === 'active'
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold text-[#0F172A]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your camera store inventory
          </p>
        </div>
        <Link href="/products/new">
          <Button className="bg-[#0369A1] text-white hover:bg-[#0369A1]/90 gap-1.5">
            <PlusIcon className="size-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#0369A1]/10">
            <PackageIcon className="size-5 text-[#0369A1]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#0F172A]">{products.length}</p>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#16A34A]/10">
            <CheckCircleIcon className="size-5 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#0F172A]">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Products</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertTriangleIcon className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#0F172A]">{lowStockCount}</p>
            <p className="text-xs text-muted-foreground">Low Stock Items</p>
          </div>
        </Card>
      </div>

      {/* Products Table (Client Component) */}
      <ProductsTable
        products={products}
        categories={categories}
        userRole={userRole}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/products/page.tsx"
git commit -m "feat: replace products placeholder with full server component list page"
```

---

### Task 8: Add Product Page

**Files:**
- Create: `app/(dashboard)/products/new/page.tsx`

- [ ] **Step 1: Create the new product page**

```typescript
// app/(dashboard)/products/new/page.tsx
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { ProductForm } from '@/components/products/ProductForm'
import { getCategories } from '@/actions/categories'

export default async function NewProductPage() {
  const categories = await getCategories()

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Back nav */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Products
      </Link>

      <div>
        <h1
          className="text-2xl font-bold text-[#0F172A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Add Product
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fill in the details below to add a new product to your inventory
        </p>
      </div>

      <ProductForm mode="create" categories={categories} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/products/new/page.tsx"
git commit -m "feat: add New Product page"
```

---

### Task 9: Edit Product Page

**Files:**
- Create: `app/(dashboard)/products/[id]/edit/page.tsx`

- [ ] **Step 1: Create the edit page with dynamic route**

```typescript
// app/(dashboard)/products/[id]/edit/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { ProductForm } from '@/components/products/ProductForm'
import { getProduct } from '@/actions/products'
import { getCategories } from '@/actions/categories'

interface EditProductPageProps {
  params: { id: string }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const [product, categories] = await Promise.all([
    getProduct(params.id),
    getCategories(),
  ])

  if (!product) notFound()

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Back nav */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Products
      </Link>

      <div>
        <h1
          className="text-2xl font-bold text-[#0F172A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Edit Product
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Editing: <span className="font-medium text-foreground">{product.name}</span>
        </p>
      </div>

      <ProductForm mode="edit" product={product} categories={categories} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/products/[id]/edit/page.tsx"
git commit -m "feat: add Edit Product page"
```

---

### Task 10: Build Verification & Fix TypeScript Errors

**Files:**
- Any files with TypeScript errors found during build

- [ ] **Step 1: Run the Next.js build**

```powershell
cd "C:\Users\PC\Desktop\DS POS"
npm run build 2>&1
```

Expected: Build completes with 0 TypeScript errors. If errors appear, go to Step 2.

- [ ] **Step 2: Fix any TypeScript errors found**

Common issues to watch for:
- `zod` v4 coerce API: use `z.coerce.number()` not `z.number().coerce()`
- `react-barcode` default import: `import Barcode from 'react-barcode'`
- `@hookform/resolvers/zod` v5: resolver is `zodResolver` from `@hookform/resolvers/zod`
- Supabase `createClient()` in server actions returns a promise — must be `await`ed
- `notFound()` in Next.js 14 is from `next/navigation`
- The `Promise.all` in products page returns `[Product[], Category[], SupabaseClient]` — the third element needs to be destructured differently since `createClient()` is async. Use sequential awaits instead if type issues arise.

If the products page build fails due to `Promise.all` with `createClient()`:

```typescript
// Fix for products/page.tsx if Promise.all type error occurs:
const products = await getProducts()
const categories = await getCategories()
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

- [ ] **Step 3: Re-run build after fixes**

```powershell
npm run build 2>&1
```

Expected: Build succeeds.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from build verification"
```

---

## Post-Build Setup Notes

After the build passes, the following manual setup is required in Supabase Dashboard:

1. **Storage bucket:** Go to Storage → New Bucket → Name: `product-images` → Toggle Public ON → Create
2. **RLS policies** (if not already set): Allow authenticated users to upload/read from `product-images`

These cannot be automated via server actions without the service role key.
