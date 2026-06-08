'use client'

import { useState, useRef } from 'react'
import { SearchIcon, CameraIcon, XIcon, PackageIcon } from 'lucide-react'
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
      setQuery('')
      inputRef.current?.focus()
      return
    }
    if (product.current_stock <= 0) {
      toast.error(`"${product.name}" is out of stock.`)
      setQuery('')
      inputRef.current?.focus()
      return
    }
    onAdd(product)
    setQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    // Exact barcode or SKU match first (case-insensitive)
    const lower = trimmed.toLowerCase()
    const exact = products.find(
      p => p.barcode?.toLowerCase() === lower || p.sku.toLowerCase() === lower
    )
    if (exact) {
      handleSelect(exact)
      return
    }

    // Single result in dropdown — add it
    if (filtered.length === 1) {
      handleSelect(filtered[0])
      return
    }

    toast.error(`No product found: "${trimmed}"`)
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
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <input
            ref={inputRef}
            id="billing-search-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search product by name, SKU or barcode…"
            autoFocus
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={startScan}
          className="h-12 w-12 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
          title="Scan barcode"
        >
          <CameraIcon className="size-5 text-slate-500" />
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
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden ring-1 ring-black/[0.04]">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <PackageIcon className="size-4 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku} · Stock: {p.current_stock}</p>
                </div>
              </div>
              <div className="shrink-0 ml-4 text-right">
                <p className="text-sm font-bold text-slate-900">₹{p.selling_price.toFixed(2)}</p>
                <p className={`text-xs font-medium ${p.current_stock <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {p.current_stock <= 0 ? 'Out of stock' : p.current_stock <= 3 ? 'Low stock' : 'In stock'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
