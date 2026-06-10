'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { createManualInvoice } from '@/actions/create-manual-invoice'
import type { Product } from '@/types/database'
import { ProductCombobox } from '@/components/stock-in/ProductCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LineItem {
  _key: string
  product_id: string
  quantity: number
  supplier_price_incl_gst: number // what supplier charged (incl. GST) = our cost
  selling_price: number           // what we sell at (user enters directly)
}

interface Props {
  products: Product[]
}

export default function StockInForm({ products }: Props) {
  const router = useRouter()
  const [supplierName, setSupplierName] = useState('')
  const [supplierGstin, setSupplierGstin] = useState('')
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<LineItem[]>([
    { _key: crypto.randomUUID(), product_id: '', quantity: 1, supplier_price_incl_gst: 0, selling_price: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)

  function addItem() {
    setItems(prev => [
      ...prev,
      { _key: crypto.randomUUID(), product_id: '', quantity: 1, supplier_price_incl_gst: 0, selling_price: 0 },
    ])
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function handleProductChange(key: string, productId: string) {
    const product = products.find(p => p.id === productId)
    setItems(prev =>
      prev.map(i =>
        i._key === key
          ? {
              ...i,
              product_id: productId,
              supplier_price_incl_gst: product?.cost_price ?? 0,
              selling_price: product?.selling_price ?? 0,
            }
          : i
      )
    )
  }

  function updateItem(key: string, field: 'quantity' | 'supplier_price_incl_gst' | 'selling_price', value: number) {
    setItems(prev => prev.map(i => (i._key === key ? { ...i, [field]: value } : i)))
  }

  // Invoice total = what we owe supplier (qty × supplier price incl. GST)
  const invoiceTotal = items.reduce((sum, i) => sum + i.quantity * i.supplier_price_incl_gst, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.product_id && i.quantity > 0 && i.supplier_price_incl_gst >= 0)
    if (validItems.length === 0) {
      toast.error('Add at least one valid item.')
      return
    }
    setSubmitting(true)
    try {
      await createManualInvoice({
        supplier_name: supplierName || undefined,
        supplier_gstin: supplierGstin || undefined,
        purchase_invoice_no: purchaseInvoiceNo || undefined,
        purchase_date: purchaseDate,
        items: validItems.map(({ product_id, quantity, supplier_price_incl_gst, selling_price }) => ({
          product_id,
          quantity,
          cost_price: supplier_price_incl_gst,
          selling_price,
        })),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl">
      {/* Supplier Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Supplier Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="supplier_name">Supplier Name</Label>
            <Input id="supplier_name" type="text" placeholder="e.g. ABC Distributors"
              value={supplierName} onChange={e => setSupplierName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase_invoice_no">Invoice No</Label>
            <Input id="purchase_invoice_no" type="text" placeholder="e.g. INV-2024-001"
              value={purchaseInvoiceNo} onChange={e => setPurchaseInvoiceNo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase_date">Purchase Date *</Label>
            <Input id="purchase_date" type="date" required
              value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier_gstin">
              Supplier GSTIN <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input id="supplier_gstin" type="text" placeholder="e.g. 36AALCS6285M1ZI"
              value={supplierGstin} onChange={e => setSupplierGstin(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Items</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter cost (incl. GST from supplier) and your selling price</p>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_70px_160px_160px_110px_40px] gap-2 px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Product</span>
          <span>Qty</span>
          <span>Supplier Cost (₹ incl. GST)</span>
          <span className="text-emerald-600">Your Selling Price (₹)</span>
          <span className="text-right">Subtotal</span>
          <span />
        </div>

        <div className="divide-y divide-slate-100">
          {items.map(item => {
            const profit = item.selling_price - item.supplier_price_incl_gst
            const subtotal = item.quantity * item.supplier_price_incl_gst

            return (
              <div key={item._key} className="px-4 sm:px-6 py-3">
                {/* Mobile */}
                <div className="flex flex-col gap-2 lg:hidden">
                  <ProductCombobox products={products} value={item.product_id}
                    onChange={id => handleProductChange(item._key, id)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Qty</span>
                      <Input type="number" min="1" value={item.quantity}
                        onChange={e => updateItem(item._key, 'quantity', Number(e.target.value))}
                        className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Supplier Cost (incl. GST)</span>
                      <Input type="number" min="0" step="0.01" value={item.supplier_price_incl_gst}
                        onChange={e => updateItem(item._key, 'supplier_price_incl_gst', Number(e.target.value))}
                        className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Your Selling Price (₹)</span>
                      <Input type="number" min="0" step="0.01" value={item.selling_price}
                        onChange={e => updateItem(item._key, 'selling_price', Number(e.target.value))}
                        className="h-10 text-base font-bold border-emerald-300 focus:border-emerald-400 focus:ring-emerald-400/20" />
                      {item.selling_price > 0 && item.supplier_price_incl_gst > 0 && (
                        <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {profit >= 0 ? '+' : ''}₹{profit.toFixed(2)} profit per unit
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 tabular-nums">
                      Subtotal: ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={() => removeItem(item._key)} disabled={items.length === 1}>
                      <Trash2Icon className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden lg:grid lg:grid-cols-[1fr_70px_160px_160px_110px_40px] gap-2 items-start">
                  <ProductCombobox products={products} value={item.product_id}
                    onChange={id => handleProductChange(item._key, id)} />
                  <Input type="number" min="1" value={item.quantity}
                    onChange={e => updateItem(item._key, 'quantity', Number(e.target.value))}
                    className="h-9 text-sm" aria-label="Quantity" />
                  <Input type="number" min="0" step="0.01" value={item.supplier_price_incl_gst}
                    onChange={e => updateItem(item._key, 'supplier_price_incl_gst', Number(e.target.value))}
                    className="h-9 text-sm" aria-label="Supplier cost incl GST" />
                  <div className="space-y-1">
                    <Input type="number" min="0" step="0.01" value={item.selling_price}
                      onChange={e => updateItem(item._key, 'selling_price', Number(e.target.value))}
                      className="h-9 text-sm font-semibold border-emerald-300 focus:border-emerald-400 focus:ring-emerald-400/20"
                      aria-label="Selling price" />
                    {item.selling_price > 0 && item.supplier_price_incl_gst > 0 && (
                      <p className={`text-[11px] font-medium tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {profit >= 0 ? '+' : ''}₹{profit.toFixed(2)} profit
                      </p>
                    )}
                  </div>
                  <div className="h-9 flex items-center justify-end text-sm tabular-nums text-slate-700 font-medium">
                    ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex justify-center">
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={() => removeItem(item._key)} disabled={items.length === 1}
                      aria-label="Remove item">
                      <Trash2Icon className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
            <PlusIcon className="size-4" /> Add Item
          </Button>
          <div className="text-sm font-semibold text-slate-800 tabular-nums">
            Invoice Total:{' '}
            <span className="text-slate-600">
              ₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/stock-in')} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}
          className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white">
          {submitting ? 'Saving...' : 'Save Invoice'}
        </Button>
      </div>
    </form>
  )
}
