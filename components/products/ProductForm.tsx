'use client'

import React, { useRef, useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import Barcode from 'react-barcode'
import { Loader2Icon, RefreshCwIcon, ImageIcon, XIcon, UploadIcon, ChevronDownIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'

import { createProduct, updateProduct } from '@/actions/products'
import { createCategory } from '@/actions/categories'
import type { Category, Product } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

const CAMERA_BRANDS = [
  'Canon', 'Nikon', 'Sony', 'Fujifilm', 'Olympus', 'Panasonic',
  'Leica', 'Pentax', 'Sigma', 'Tamron', 'Tokina', 'Godox',
  'DJI', 'GoPro', 'Manfrotto', 'Joby', 'Peak Design',
]

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
  low_stock_alert: z.coerce.number().min(0),
  opening_stock: z.coerce.number().min(0),
  serial_required: z.boolean(),
  status: z.enum(['active', 'inactive']),
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
  const [brandInput, setBrandInput] = useState<string>(product?.brand ?? '')
  const [showBrandList, setShowBrandList] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    mode: 'onBlur',
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
      opening_stock: 0,
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Not logged in'); setImageUploading(false); return }

      const ext = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('Product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        const code = uploadError.statusCode ?? uploadError.status ?? ''
        const msg = uploadError.message ?? ''
        if (msg.includes('not found') || msg.includes('does not exist') || code === '404' || code === 404) {
          throw new Error('Bucket missing: Supabase → Storage → New Bucket → name: Product-images → Public ON')
        }
        if (code === '403' || code === 403 || msg.includes('policy') || msg.includes('permission') || msg.includes('violates')) {
          throw new Error('Storage permission denied. Supabase → Storage → product-images → Policies → Add policy: allow authenticated users to INSERT')
        }
        throw new Error(`Upload failed (${code}): ${msg}`)
      }

      const { data: urlData } = supabase.storage
        .from('Product-images')
        .getPublicUrl(fileName)

      setImageUrl(urlData.publicUrl)
      toast.success('Image uploaded')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Image upload failed')
      console.error('Image upload error:', err)
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
          brand: brandInput || undefined,
          image_url: imageUrl || undefined,
          category_id: values.category_id || undefined,
          barcode: values.barcode || undefined,
          hsn_code: values.hsn_code || undefined,
          opening_stock: mode === 'create' ? (values.opening_stock ?? 0) : undefined,
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
            <div className="relative">
              <Input
                id="brand"
                value={brandInput}
                onChange={e => {
                  setBrandInput(e.target.value)
                  setValue('brand', e.target.value)
                  setShowBrandList(true)
                }}
                onFocus={() => setShowBrandList(true)}
                onBlur={() => setTimeout(() => setShowBrandList(false), 150)}
                placeholder="e.g. Canon"
                autoComplete="off"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowBrandList(v => !v)}
              >
                <ChevronDownIcon className="size-4" />
              </button>
              {showBrandList && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white shadow-lg">
                  {CAMERA_BRANDS.filter(b =>
                    b.toLowerCase().includes(brandInput.toLowerCase())
                  ).map(b => (
                    <button
                      key={b}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                      onMouseDown={() => {
                        setBrandInput(b)
                        setValue('brand', b)
                        setShowBrandList(false)
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={watch('category_id') ?? ''}
                onChange={e => setValue('category_id', e.target.value)}
                className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

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
                    className="bg-[#111827] text-white hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200"
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
          Pricing &amp; Tax
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
          Inventory &amp; Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="opening_stock">Opening Stock Qty</Label>
              <Input id="opening_stock" type="number" min="0" {...register('opening_stock')} />
              <p className="text-xs text-muted-foreground">Stock on hand right now</p>
            </div>
          )}

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
                className="h-4 w-4 rounded border-border accent-[#111827]"
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
          <div
            className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-slate-50 shrink-0 overflow-hidden cursor-pointer hover:border-[#111827] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Product" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="size-8" />
                <span className="text-xs">Click to upload</span>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            disabled={imageUploading}
            className="hidden"
          />

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="gap-2"
            >
              {imageUploading ? (
                <><Loader2Icon className="size-4 animate-spin" /> Uploading...</>
              ) : (
                <><UploadIcon className="size-4" /> Choose Image</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, WebP.</p>
            {imageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImageUrl('')}
                className="text-destructive gap-1"
              >
                <XIcon className="size-3" /> Remove Image
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
          className="bg-[#111827] text-white hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 min-w-[120px]"
        >
          {isPending ? (
            <><Loader2Icon className="size-4 animate-spin mr-2" /> Saving...</>
          ) : mode === 'create' ? 'Create Product' : 'Update Product'}
        </Button>
      </div>
    </form>
  )
}
