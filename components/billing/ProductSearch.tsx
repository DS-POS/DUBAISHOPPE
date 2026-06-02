'use client'

import { useState, useRef } from 'react'
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
