'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStockAdjustment } from '@/actions/stock-adjustments'
import type { Product, StockAdjustmentType } from '@/types/database'

const ADJUSTMENT_TYPES: { value: StockAdjustmentType; label: string; sign: '+' | '-'; color: string }[] = [
  { value: 'found',      label: 'Found / Received', sign: '+', color: 'text-emerald-600' },
  { value: 'return',     label: 'Customer Return',  sign: '+', color: 'text-blue-600'    },
  { value: 'damage',     label: 'Damage / Loss',    sign: '-', color: 'text-red-600'     },
  { value: 'write_off',  label: 'Write-Off',        sign: '-', color: 'text-red-600'     },
  { value: 'correction', label: 'Manual Correction',sign: '+', color: 'text-amber-600'   },
]

interface Props {
  products: Product[]
}

export function StockAdjustmentForm({ products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [productId, setProductId] = useState('')
  const [adjType, setAdjType] = useState<StockAdjustmentType>('correction')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const selectedProduct = products.find(p => p.id === productId)
  const typeConfig = ADJUSTMENT_TYPES.find(t => t.value === adjType)!
  const actualQty = typeConfig.sign === '-' ? -Math.abs(qty) : Math.abs(qty)
  const projectedStock = selectedProduct ? selectedProduct.current_stock + actualQty : null

  const filteredProducts = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 10)
    : []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { toast.error('Select a product'); return }
    if (qty <= 0) { toast.error('Quantity must be > 0'); return }
    if (projectedStock !== null && projectedStock < 0) {
      toast.error(`Cannot reduce stock below 0. Current: ${selectedProduct!.current_stock}`)
      return
    }

    startTransition(async () => {
      try {
        await createStockAdjustment({
          product_id: productId,
          adjustment_type: adjType,
          quantity: actualQty,
          notes: notes.trim() || null,
        })
        toast.success('Stock adjusted successfully')
        router.push('/stock-adjustments')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save adjustment')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Product search */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Product *</label>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setProductId(''); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search product by name or SKU…"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
          {showDropdown && search && !productId && filteredProducts.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
              {filteredProducts.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setProductId(p.id); setSearch(p.name); setShowDropdown(false) }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-slate-500 text-xs">{p.sku} · Stock: {p.current_stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProduct && (
          <p className="text-xs text-slate-500">Current stock: <strong>{selectedProduct.current_stock}</strong> units</p>
        )}
      </div>

      {/* Adjustment type */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Adjustment Type *</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ADJUSTMENT_TYPES.map(t => (
            <button key={t.value} type="button"
              onClick={() => setAdjType(t.value)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition-all ${
                adjType === t.value
                  ? 'border-[#111827] bg-[#111827] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={adjType === t.value ? 'text-white' : t.color}>{t.sign} </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Quantity *</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
        {projectedStock !== null && (
          <p className={`text-xs font-medium ${projectedStock < 0 ? 'text-red-600' : 'text-slate-500'}`}>
            Projected stock after adjustment: <strong>{projectedStock}</strong> units
            {projectedStock < 0 && ' — cannot go below 0'}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Reason for adjustment, reference number, etc."
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !productId || (projectedStock !== null && projectedStock < 0)}
          className="flex-1 rounded-xl bg-[#111827] py-2.5 text-sm font-semibold text-white hover:bg-[#1F2937] disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Adjustment'}
        </button>
      </div>
    </form>
  )
}
