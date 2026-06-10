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
  cost_price: number
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
    { _key: crypto.randomUUID(), product_id: '', quantity: 1, cost_price: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)

  function addItem() {
    setItems(prev => [
      ...prev,
      { _key: crypto.randomUUID(), product_id: '', quantity: 1, cost_price: 0 },
    ])
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function updateItem(key: string, field: keyof Omit<LineItem, '_key'>, value: string | number) {
    setItems(prev => prev.map(i => (i._key === key ? { ...i, [field]: value } : i)))
  }

  function handleProductChange(key: string, productId: string) {
    const product = products.find(p => p.id === productId)
    setItems(prev =>
      prev.map(i =>
        i._key === key
          ? { ...i, product_id: productId, cost_price: product?.cost_price ?? i.cost_price }
          : i
      )
    )
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.cost_price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.product_id && i.quantity > 0 && i.cost_price >= 0)
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
        items: validItems.map(({ product_id, quantity, cost_price }) => ({
          product_id,
          quantity,
          cost_price,
        })),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* Section 1: Supplier Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Supplier Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="supplier_name">Supplier Name</Label>
            <Input
              id="supplier_name"
              type="text"
              placeholder="e.g. ABC Distributors"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase_invoice_no">Invoice No</Label>
            <Input
              id="purchase_invoice_no"
              type="text"
              placeholder="e.g. INV-2024-001"
              value={purchaseInvoiceNo}
              onChange={e => setPurchaseInvoiceNo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase_date">Purchase Date *</Label>
            <Input
              id="purchase_date"
              type="date"
              required
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier_gstin">
              Supplier GSTIN{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="supplier_gstin"
              type="text"
              placeholder="e.g. 29ABCDE1234F1Z5"
              value={supplierGstin}
              onChange={e => setSupplierGstin(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Line Items */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_90px_130px_110px_40px] gap-3 px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500">
          <span>Product</span>
          <span>Qty</span>
          <span>Cost Price (₹)</span>
          <span className="text-right">Subtotal</span>
          <span />
        </div>

        {/* Item rows */}
        <div className="divide-y divide-slate-100">
          {items.map(item => (
            <div
              key={item._key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_90px_130px_110px_40px] gap-3 items-center px-6 py-3"
            >
              {/* Product */}
              <div>
                <ProductCombobox
                  products={products}
                  value={item.product_id}
                  onChange={id => handleProductChange(item._key, id)}
                />
              </div>

              {/* Qty */}
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={e => updateItem(item._key, 'quantity', Number(e.target.value))}
                className="h-9 text-sm"
                aria-label="Quantity"
              />

              {/* Cost Price */}
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.cost_price}
                onChange={e => updateItem(item._key, 'cost_price', Number(e.target.value))}
                className="h-9 text-sm"
                aria-label="Cost price"
              />

              {/* Subtotal */}
              <div className="text-right text-sm tabular-nums text-slate-700 font-medium">
                ₹{(item.quantity * item.cost_price).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </div>

              {/* Remove */}
              <div className="flex justify-end sm:justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => removeItem(item._key)}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2Icon className="size-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: Add item + Total */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
            <PlusIcon className="size-4" />
            Add Item
          </Button>
          <div className="text-sm font-semibold text-slate-800 tabular-nums">
            Total:{' '}
            <span className="text-slate-500">
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/stock-in')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white"
        >
          {submitting ? 'Saving...' : 'Save Invoice'}
        </Button>
      </div>
    </form>
  )
}
