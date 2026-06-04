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
  selling_price_mode: 'percent' | 'flat'
  selling_price_value: number
}

function computeSellingPrice(item: ReviewItem): number {
  if (item.selling_price_mode === 'percent') {
    return Number((item.unit_price * (1 + item.selling_price_value / 100)).toFixed(2))
  }
  return Number((item.unit_price + item.selling_price_value).toFixed(2))
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
          selling_price_mode: 'percent',
          selling_price_value: 20,
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
          selling_price: item.action !== 'skip' ? computeSellingPrice(item) : undefined,
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
                {/* Selling Price */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Selling Price:</span>
                  <button
                    type="button"
                    onClick={() => updateItem(i, {
                      selling_price_mode: item.selling_price_mode === 'percent' ? 'flat' : 'percent',
                      selling_price_value: item.selling_price_mode === 'percent' ? 0 : 20,
                    })}
                    className="px-2 py-0.5 text-xs rounded border border-input hover:bg-accent w-9 text-center shrink-0 font-mono"
                    title="Toggle markup mode"
                  >
                    {item.selling_price_mode === 'percent' ? '%' : '+₹'}
                  </button>
                  <Input
                    type="number"
                    value={item.selling_price_value}
                    onChange={e => updateItem(i, { selling_price_value: Number(e.target.value) })}
                    className="h-7 text-xs w-20"
                    min={0}
                    step={item.selling_price_mode === 'percent' ? 1 : 100}
                  />
                  <span className="text-xs font-medium text-emerald-600 shrink-0">
                    = ₹{computeSellingPrice(item).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

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
