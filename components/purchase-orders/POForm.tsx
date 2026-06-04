'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { createPurchaseOrder, type POLineInput } from '@/actions/purchase-orders'
import type { Product, Supplier } from '@/types/database'

interface Props {
  products: Pick<Product, 'id' | 'name' | 'sku' | 'cost_price'>[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

interface LineItem {
  _id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
}

function newLine(): LineItem {
  return { _id: crypto.randomUUID(), product_id: null, product_name: '', sku: null, quantity_ordered: 1, unit_cost: 0 }
}

export function POForm({ products, suppliers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([newLine()])

  function selectSupplier(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => s.id === id)
    if (sup) setSupplierName(sup.name)
  }

  function selectProduct(lineId: string, productId: string) {
    const product = products.find(p => p.id === productId)
    setLines(prev => prev.map(l =>
      l._id === lineId
        ? { ...l, product_id: productId, product_name: product?.name ?? '', sku: product?.sku ?? null, unit_cost: product?.cost_price ?? 0 }
        : l
    ))
  }

  function updateLine(lineId: string, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => l._id === lineId ? { ...l, [field]: value } : l))
  }

  function removeLine(lineId: string) {
    if (lines.length === 1) return
    setLines(prev => prev.filter(l => l._id !== lineId))
  }

  const totalAmount = lines.reduce((s, l) => s + l.quantity_ordered * l.unit_cost, 0)

  function handleSubmit() {
    if (!supplierName.trim()) { toast.error('Enter supplier name.'); return }
    const validLines = lines.filter(l => l.product_name.trim() && l.quantity_ordered > 0)
    if (validLines.length === 0) { toast.error('Add at least one item.'); return }

    const items: POLineInput[] = validLines.map(l => ({
      product_id: l.product_id,
      product_name: l.product_name,
      sku: l.sku,
      quantity_ordered: l.quantity_ordered,
      unit_cost: l.unit_cost,
    }))

    startTransition(async () => {
      try {
        const poId = await createPurchaseOrder({
          supplier_id: supplierId || null,
          supplier_name: supplierName,
          expected_date: expectedDate || undefined,
          notes: notes || undefined,
          items,
        })
        toast.success('Purchase Order created.')
        router.push(`/purchase-orders/${poId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create PO.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Supplier</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Select Supplier</label>
            <select
              value={supplierId}
              onChange={e => selectSupplier(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            >
              <option value="">— Select or type below —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Supplier Name *</label>
            <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier name" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Expected Delivery Date</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Items</h3>
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase px-1">
          <div className="col-span-4">Product</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Cost</div>
          <div className="col-span-1" />
        </div>
        {lines.map(line => (
          <div key={line._id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4">
              <select
                value={line.product_id ?? ''}
                onChange={e => selectProduct(line._id, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
              >
                <option value="">Select…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <input
                type="text"
                value={line.product_name}
                onChange={e => updateLine(line._id, 'product_name', e.target.value)}
                placeholder="Name"
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
              />
            </div>
            <div className="col-span-2">
              <input type="number" min={1} value={line.quantity_ordered} onChange={e => updateLine(line._id, 'quantity_ordered', parseInt(e.target.value) || 1)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none text-center" />
            </div>
            <div className="col-span-2">
              <input type="number" min={0} step={0.01} value={line.unit_cost} onChange={e => updateLine(line._id, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none text-right" />
            </div>
            <div className="col-span-1 text-right">
              {lines.length > 1 && (
                <button onClick={() => removeLine(line._id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2Icon className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setLines(prev => [...prev, newLine()])} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-2">
          <PlusIcon className="size-4" /> Add Item
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-bold text-slate-900">Total: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={isPending} className="px-6 py-2.5 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {isPending ? 'Creating…' : 'Create Purchase Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
