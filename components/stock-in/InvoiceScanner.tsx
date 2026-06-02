'use client'

import { useState, useRef } from 'react'
import {
  ScanLineIcon,
  CameraIcon,
  ImageIcon,
  FileTextIcon,
  XIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { extractInvoiceData, type ExtractedInvoiceData, type ExtractedItem } from '@/actions/extract-invoice'
import { prepareFile } from '@/lib/compress-file'
import type { Product } from '@/types/database'

interface InvoiceScannerProps {
  products: Product[]
  onItemSelected: (data: {
    supplier_name?: string
    supplier_gstin?: string
    purchase_invoice_no?: string
    purchase_date?: string
    quantity: number
    cost_price: number
    notes?: string
    matched_product_id?: string
  }) => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function findMatchingProduct(description: string, products: Product[]): string | undefined {
  const desc = description.toLowerCase()
  // 1. SKU exact match inside description
  const bySku = products.find(p => desc.includes(p.sku.toLowerCase()))
  if (bySku) return bySku.id
  // 2. Product name substring
  const byName = products.find(p => {
    const name = p.name.toLowerCase()
    return desc.includes(name) || name.includes(desc)
  })
  return byName?.id
}

export function InvoiceScanner({ products, onItemSelected }: InvoiceScannerProps) {
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const cameraRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setExtracted(null)
    setFileName(file.name)
    setProcessing(true)
    try {
      const prepared = await prepareFile(file)
      if (prepared.warning) toast.warning(prepared.warning)
      if (prepared.compressed) {
        toast.info(
          `Image compressed: ${prepared.originalKB} KB → ${prepared.compressedKB} KB`,
          { duration: 3000 }
        )
      }
      const base64 = await fileToBase64(prepared.file)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 30_000)
      )
      const data = await Promise.race([extractInvoiceData(base64, prepared.file.type), timeout])
      setExtracted(data)
      if (!data.items || data.items.length === 0) {
        toast.warning('No line items found in invoice.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to extract invoice data.'
      setError(msg)
      toast.error(msg)
    } finally {
      setProcessing(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleSelectItem(item: ExtractedItem) {
    const matched_product_id = findMatchingProduct(item.description, products)
    onItemSelected({
      supplier_name: extracted?.supplier_name,
      supplier_gstin: extracted?.supplier_gstin,
      purchase_invoice_no: extracted?.purchase_invoice_no,
      purchase_date: extracted?.purchase_date,
      quantity: item.quantity,
      cost_price: item.unit_price,
      notes: item.hsn_code ? `HSN: ${item.hsn_code}` : undefined,
      matched_product_id,
    })
    toast.success(
      matched_product_id
        ? 'Invoice data loaded — product matched!'
        : 'Invoice data loaded — please select the product manually.'
    )
    setOpen(false)
    setExtracted(null)
    setFileName(null)
  }

  function reset() {
    setExtracted(null)
    setError(null)
    setFileName(null)
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <ScanLineIcon className="size-4" />
          <span>Scan / Upload Invoice</span>
          {fileName && !open && (
            <span className="text-xs text-primary">• {fileName}</span>
          )}
        </div>
        {open ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Upload options */}
          {!processing && !extracted && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Upload or scan your supplier invoice — fields will auto-fill.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {/* Camera */}
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background py-3 px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <CameraIcon className="size-5 text-muted-foreground" />
                  Camera
                </button>
                {/* Image */}
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background py-3 px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <ImageIcon className="size-5 text-muted-foreground" />
                  Image
                </button>
                {/* PDF */}
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background py-3 px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <FileTextIcon className="size-5 text-muted-foreground" />
                  PDF
                </button>
              </div>

              {/* Hidden inputs */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
              <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleInputChange} />
              <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handleInputChange} />
            </div>
          )}

          {/* Processing */}
          {processing && (
            <div className="pt-4 flex flex-col items-center gap-3 py-6">
              <Loader2Icon className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting invoice data…</p>
            </div>
          )}

          {/* Error */}
          {error && !processing && (
            <div className="pt-4 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <button type="button" onClick={reset} className="text-xs text-muted-foreground underline">
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {extracted && !processing && (
            <div className="pt-4 space-y-3">
              {/* Header info */}
              <div className="rounded-lg border border-border bg-background p-3 space-y-1 text-xs">
                {extracted.supplier_name && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">Supplier</span>
                    <span className="font-medium">{extracted.supplier_name}</span>
                  </div>
                )}
                {extracted.supplier_gstin && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">GSTIN</span>
                    <span className="font-mono">{extracted.supplier_gstin}</span>
                  </div>
                )}
                {extracted.purchase_invoice_no && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">Invoice No</span>
                    <span className="font-medium">{extracted.purchase_invoice_no}</span>
                  </div>
                )}
                {extracted.purchase_date && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">Date</span>
                    <span>{extracted.purchase_date}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              {extracted.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    {extracted.items.length} item{extracted.items.length !== 1 ? 's' : ''} — tap to load into form:
                  </p>
                  {extracted.items.map((item, i) => {
                    const matchId = findMatchingProduct(item.description, products)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-accent hover:border-primary/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty {item.quantity} · ₹{item.unit_price.toFixed(2)}
                            {item.hsn_code && ` · HSN ${item.hsn_code}`}
                          </p>
                        </div>
                        {matchId && (
                          <span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full px-2 py-0.5 border border-emerald-200 dark:border-emerald-800">
                            matched
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Reset */}
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="size-3" />
                Scan different invoice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
