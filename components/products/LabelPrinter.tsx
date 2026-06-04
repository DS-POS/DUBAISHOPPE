'use client'

import React, { useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, Printer, X, Trash2, Plus, Minus, Tag, CheckSquare, Square } from 'lucide-react'
import type { Product } from '@/types/database'

// react-barcode requires browser, load dynamically to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

interface QueueItem {
  product: Product
  quantity: number
}

interface LabelPrinterProps {
  products: Product[]
}

function getBarcodeValue(product: Product): string {
  if (product.barcode && product.barcode.trim()) return product.barcode.trim()
  if (product.sku && product.sku.trim()) return product.sku.trim()
  return 'NO-BARCODE'
}

function formatPrice(price: number): string {
  return '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function LabelPrinter({ products }: LabelPrinterProps) {
  const [search, setSearch] = useState('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    const activeIds = products.filter(p => p.status === 'active').map(p => p.id)
    setSelected(new Set(activeIds))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return products
      .filter(p => p.status === 'active')
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [search, products])

  function addToQueue(product: Product) {
    setQueue(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setSearch('')
    setShowResults(false)
    searchRef.current?.focus()
  }

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(item => item.product.id !== id))
  }

  function updateQuantity(id: string, delta: number) {
    setQueue(prev =>
      prev.map(item =>
        item.product.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    )
  }

  function setQuantityDirect(id: string, val: string) {
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 0) {
      setQueue(prev =>
        prev.map(item =>
          item.product.id === id ? { ...item, quantity: num } : item
        )
      )
    }
  }

  function clearAll() {
    setQueue([])
  }

  function handleBatchPrint() {
    const selectedProducts = products.filter(p => selected.has(p.id))
    if (selectedProducts.length === 0) return
    const labels: string[] = []
    for (const product of selectedProducts) {
      const barcodeValue = getBarcodeValue(product)
      const labelHtml = `
        <div class="label">
          <div class="store-name">DUBAI SHOPPE</div>
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="price">${formatPrice(product.selling_price)}</div>
          <div class="gst">GST: ${product.gst_rate}%${product.hsn_code ? ` &nbsp;|&nbsp; HSN: ${escapeHtml(product.hsn_code)}` : ''}</div>
          <div class="barcode-wrap">
            <svg class="barcode" data-value="${escapeHtml(barcodeValue)}"></svg>
          </div>
          <div class="sku">SKU: ${escapeHtml(product.sku)}</div>
        </div>`
      labels.push(labelHtml)
    }
    openPrintWindow(labels)
  }

  function openPrintWindow(labels: string[]) {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Please allow popups to print labels.')
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Label Print — Dubai Shoppe</title>
<style>
  @media print {
    @page { margin: 5mm; }
    body { margin: 0; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #f8f8f8; }
  .controls { padding: 10px 16px; background: #111827; color: white; display: flex; align-items: center; gap: 12px; }
  .controls button {
    background: white; color: #111827; border: none; padding: 7px 18px;
    border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px;
  }
  .controls span { font-size: 13px; }
  .labels-grid { display: flex; flex-wrap: wrap; gap: 4mm; padding: 6mm; }
  .label {
    width: 50mm; min-height: 28mm; border: 0.5px dashed #bbb;
    padding: 2mm 2.5mm; page-break-inside: avoid;
    display: flex; flex-direction: column; align-items: center;
    background: white;
  }
  .store-name {
    font-size: 6pt; color: #111827; font-weight: bold;
    text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.5mm;
  }
  .product-name {
    font-size: 7pt; font-weight: bold; text-align: center;
    line-height: 1.25; margin: 1mm 0; max-height: 2.5em;
    overflow: hidden; word-break: break-word; width: 100%;
  }
  .price { font-size: 11pt; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; }
  .gst { font-size: 5.5pt; color: #64748b; margin: 0.5mm 0; }
  .barcode-wrap { margin: 1mm 0 0.5mm; line-height: 0; }
  .barcode-wrap svg { max-width: 44mm; }
  .sku { font-size: 5pt; font-family: 'Courier New', monospace; color: #94a3b8; }
</style>
</head>
<body>
<div class="controls no-print">
  <button onclick="window.print()">&#128438; Print Labels</button>
  <button onclick="window.close()">Close</button>
  <span>${labels.length} label${labels.length !== 1 ? 's' : ''} ready</span>
</div>
<div class="labels-grid">
  ${labels.join('\n')}
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
  window.onload = function() {
    if (typeof JsBarcode !== 'undefined') {
      document.querySelectorAll('.barcode').forEach(function(el) {
        try {
          JsBarcode(el, el.getAttribute('data-value'), {
            height: 35, width: 1.5, fontSize: 9, displayValue: true,
            margin: 2, background: 'transparent'
          });
        } catch(e) {
          el.parentNode.innerHTML = '<div style="font-size:7pt;font-family:monospace;text-align:center;letter-spacing:2px">' + el.getAttribute('data-value') + '<\/div>';
        }
      });
    }
  };
<\/script>
</body>
</html>`)
    printWindow.document.close()
  }

  function handlePrint() {
    const labels: string[] = []
    for (const item of queue) {
      const barcodeValue = getBarcodeValue(item.product)
      const labelHtml = `
        <div class="label">
          <div class="store-name">DUBAI SHOPPE</div>
          <div class="product-name">${escapeHtml(item.product.name)}</div>
          <div class="price">${formatPrice(item.product.selling_price)}</div>
          <div class="gst">GST: ${item.product.gst_rate}%${item.product.hsn_code ? ` &nbsp;|&nbsp; HSN: ${escapeHtml(item.product.hsn_code)}` : ''}</div>
          <div class="barcode-wrap">
            <svg class="barcode" data-value="${escapeHtml(barcodeValue)}"></svg>
          </div>
          <div class="sku">SKU: ${escapeHtml(item.product.sku)}</div>
        </div>`
      for (let i = 0; i < item.quantity; i++) {
        labels.push(labelHtml)
      }
    }
    openPrintWindow(labels)
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  const previewProduct = queue.length > 0 ? queue[0].product : null

  return (
    <div
      className="min-h-screen bg-[#F3F4F6] p-4 md:p-6"
      style={{ fontFamily: 'Rubik, sans-serif' }}
    >
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111827] flex items-center justify-center shadow-sm">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Label Generator</h1>
              <p className="text-sm text-[#4B5563] mt-0.5">Print shelf labels with barcode for any product</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-slate-700 hover:bg-[#E5E7EB] transition"
            >
              <CheckSquare className="w-4 h-4" />
              Select All
            </button>
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-slate-500 hover:bg-[#E5E7EB] transition"
              >
                <Square className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN — Search & Queue */}
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-4">
            <h2 className="text-sm font-semibold text-[#111827] mb-3">Search Products</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowResults(true) }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 180)}
                placeholder="Search by name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] transition"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setShowResults(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="mt-2 border border-[#E5E7EB] rounded-xl overflow-hidden shadow-lg z-10 bg-white">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    onMouseDown={() => addToQueue(product)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#E5E7EB] transition text-left border-b border-[#E5E7EB] last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-bold text-[#111827]">{formatPrice(product.selling_price)}</p>
                      <p className="text-xs text-slate-400">Stock: {product.current_stock}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && search.trim() && searchResults.length === 0 && (
              <div className="mt-2 border border-[#E5E7EB] rounded-xl px-4 py-3 text-sm text-slate-500 bg-white text-center">
                No products found
              </div>
            )}
          </div>

          {/* Label Queue */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#111827]">
                Label Queue
                {queue.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111827] text-white text-xs font-bold">
                    {queue.length}
                  </span>
                )}
              </h2>
              {queue.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[#E5E7EB] flex items-center justify-center mb-3">
                  <Tag className="w-7 h-7 text-[#4B5563]" />
                </div>
                <p className="text-sm text-slate-500">Search and add products above</p>
                <p className="text-xs text-slate-400 mt-1">Set quantity per product to print multiple labels</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {queue.map(item => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] hover:border-[#111827]/50 transition"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{item.product.sku}</p>
                    </div>

                    {/* Qty control */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#E5E7EB] flex items-center justify-center transition text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => setQuantityDirect(item.product.id, e.target.value)}
                        className="w-12 text-center text-sm font-bold border border-[#E5E7EB] rounded-lg bg-white py-1 focus:outline-none focus:ring-1 focus:ring-[#111827]/20"
                      />
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#E5E7EB] flex items-center justify-center transition text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeFromQueue(item.product.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition text-slate-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={queue.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm text-sm"
          >
            <Printer className="w-4 h-4" />
            Print Labels
            {queue.length > 0 && (
              <span className="ml-1 text-white/80">
                ({queue.reduce((s, i) => s + i.quantity, 0)} total)
              </span>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN — Preview */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-4">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Label Preview</h2>

            {previewProduct ? (
              <div className="flex flex-col items-center">
                {/* Label preview card — scaled up for screen visibility */}
                <div
                  className="border border-dashed border-slate-300 rounded-sm shadow-md bg-white flex flex-col items-center"
                  style={{
                    width: '189px',   // 50mm ≈ 189px at 96dpi
                    minHeight: '106px', // 28mm ≈ 106px
                    padding: '7px 10px',
                    fontFamily: 'Arial, sans-serif',
                  }}
                >
                  {/* Store Name */}
                  <div
                    style={{
                      fontSize: '7px',
                      color: '#111827',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      marginBottom: '2px',
                    }}
                  >
                    DUBAI SHOPPE
                  </div>

                  {/* Product Name */}
                  <div
                    style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      textAlign: 'center',
                      lineHeight: 1.25,
                      maxHeight: '20px',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      width: '100%',
                      marginBottom: '3px',
                    }}
                    title={previewProduct.name}
                  >
                    {previewProduct.name}
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
                    {formatPrice(previewProduct.selling_price)}
                  </div>

                  {/* GST */}
                  <div style={{ fontSize: '6.5px', color: '#64748b', margin: '1px 0' }}>
                    GST: {previewProduct.gst_rate}%
                    {previewProduct.hsn_code ? ` | HSN: ${previewProduct.hsn_code}` : ''}
                  </div>

                  {/* Barcode */}
                  <div style={{ margin: '3px 0 2px', lineHeight: 0 }}>
                    <Barcode
                      value={getBarcodeValue(previewProduct)}
                      height={40}
                      width={1.5}
                      fontSize={9}
                      margin={2}
                    />
                  </div>

                  {/* SKU */}
                  <div
                    style={{
                      fontSize: '6px',
                      fontFamily: 'Courier New, monospace',
                      color: '#94a3b8',
                    }}
                  >
                    SKU: {previewProduct.sku}
                  </div>
                </div>

                {/* Preview meta */}
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Previewing: <span className="font-medium text-slate-600">{previewProduct.name}</span>
                </p>
                {queue.length > 1 && (
                  <p className="text-xs text-slate-400 mt-1 text-center">
                    +{queue.length - 1} more product{queue.length - 1 !== 1 ? 's' : ''} in queue
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="border border-dashed border-slate-200 rounded-sm bg-[#E5E7EB] flex flex-col items-center justify-center"
                  style={{ width: '189px', minHeight: '106px' }}
                >
                  <Tag className="w-8 h-8 text-[#D1D5DB] mb-2" />
                  <p className="text-xs text-[#4B5563]">Label preview</p>
                </div>
                <p className="text-xs text-slate-400 mt-3">Add a product to see the label preview</p>
              </div>
            )}
          </div>

          {/* Label info card */}
          <div className="bg-[#E5E7EB] rounded-2xl border border-[#E5E7EB] p-4">
            <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wide mb-2">Label Specs</h3>
            <ul className="text-xs text-[#4B5563] space-y-1">
              <li>Size: 50mm × 28mm per label</li>
              <li>Layout: 2 labels per row</li>
              <li>Barcode: Code128 (auto-generated)</li>
              <li>Barcode source: barcode field → SKU → fallback</li>
              <li>Opens in new window for print preview</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Batch Select Product Grid */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#111827]">
            Batch Select
            <span className="ml-2 text-xs font-normal text-[#4B5563]">— tick products to print one label each</span>
          </h2>
          {selected.size > 0 && (
            <span className="text-xs text-slate-500">{selected.size} selected</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
          {products.filter(p => p.status === 'active').map(product => {
            const isSelected = selected.has(product.id)
            return (
              <button
                key={product.id}
                onClick={() => toggleSelect(product.id)}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-[#111827] bg-[#111827] text-white'
                    : 'border-[#E5E7EB] bg-white text-slate-800 hover:border-[#111827]/40'
                }`}
              >
                <div className={`absolute top-2 right-2 ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </div>
                <p className={`text-xs font-semibold leading-snug pr-5 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {product.name}
                </p>
                <p className={`text-xs font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  {product.sku}
                </p>
                <p className={`text-sm font-bold mt-1 ${isSelected ? 'text-white' : 'text-[#111827]'}`}>
                  {formatPrice(product.selling_price)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sticky Bottom Bar for Batch Print */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl">
          <span className="text-sm font-medium">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={handleBatchPrint}
            className="px-4 py-1.5 bg-white text-[#111827] rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Print {selected.size} Labels
          </button>
          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-white text-sm"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
