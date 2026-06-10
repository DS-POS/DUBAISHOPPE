'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Product, Customer } from '@/types/database'
import { type CartItem, recalcItem, cartTotals } from './types'
import { ProductSearch } from './ProductSearch'
import { CartItemRow } from './CartItemRow'
import { SerialPicker } from './SerialPicker'
import { CustomerSelector } from './CustomerSelector'
import { CartSummary } from './CartSummary'
import { ShoppingCartIcon, ArrowRightIcon } from 'lucide-react'
import { getCustomerCreditStatus, type CustomerCreditStatus } from '@/actions/customers'
import { useBarcodeScanner } from './BarcodeScanner'

interface BillingFormProps {
  products: Product[]
  customers: Customer[]
}

export default function BillingForm({ products, customers }: BillingFormProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serialPickTarget, setSerialPickTarget] = useState<string | null>(null)
  const [creditStatus, setCreditStatus] = useState<CustomerCreditStatus | null>(null)

  const customerState = customer?.state ?? 'Telangana'

  function addProduct(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && !product.serial_required)
      if (existing) {
        return prev.map(i =>
          i._id === existing._id
            ? recalcItem({ ...i, quantity: i.quantity + 1 }, customerState)
            : i
        )
      }
      const newItem: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total' | 'discount'> = {
        _id: crypto.randomUUID(),
        product,
        quantity: 1,
        rate: product.selling_price,
        discount_mode: 'percent',
        discount_raw: 0,
        serial_number: null,
        is_taxable: product.is_taxable,
      }
      return [...prev, recalcItem(newItem, customerState)]
    })
  }

  function handleBarcodeScan(barcode: string) {
    const found = products.find(p => p.barcode === barcode || p.sku === barcode)
    const el = document.getElementById('barcode-status')
    if (found) {
      addProduct(found)
      if (el) {
        el.textContent = `✓ ${found.name} added`
        el.className = 'h-4 text-xs text-emerald-600 font-medium'
        setTimeout(() => { el.textContent = ''; el.className = 'h-4 text-xs' }, 2000)
      }
    } else {
      if (el) {
        el.textContent = `Barcode not found: ${barcode}`
        el.className = 'h-4 text-xs text-red-500 font-medium'
        setTimeout(() => { el.textContent = ''; el.className = 'h-4 text-xs' }, 2000)
      }
    }
    // Refocus search input so next scan is ready immediately
    document.getElementById('billing-search-input')?.focus()
  }
  useBarcodeScanner({ onScan: handleBarcodeScan, enabled: true })

  function updateQty(id: string, qty: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, quantity: qty }, customerState) : i))
  }

  function updateRate(id: string, rate: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, rate }, customerState) : i))
  }

  function updateDiscountRaw(id: string, raw: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount_raw: raw }, customerState) : i))
  }

  function updateDiscountMode(id: string, mode: 'percent' | 'flat') {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount_mode: mode }, customerState) : i))
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i._id !== id))
  }

  function pickSerial(id: string) {
    setSerialPickTarget(id)
  }

  function handleSerialSelect(serial: string) {
    setCart(prev => prev.map(i => i._id === serialPickTarget ? { ...i, serial_number: serial } : i))
    setSerialPickTarget(null)
  }

  const handleCustomerChange = useCallback(async (c: Customer | null) => {
    setCustomer(c)
    const state = c?.state ?? 'Telangana'
    setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
    if (c && c.credit_limit > 0) {
      const status = await getCustomerCreditStatus(c.id)
      setCreditStatus(status)
    } else {
      setCreditStatus(null)
    }
  }, [])

  function handleCheckout() {
    if (creditStatus?.over_limit && customer?.credit_limit && customer.credit_limit > 0) {
      toast.error(`Credit limit exceeded. Outstanding: ₹${creditStatus.outstanding.toLocaleString('en-IN')}. Limit: ₹${customer.credit_limit.toLocaleString('en-IN')}`)
      return
    }
    if (cart.length === 0) {
      toast.error('Cart is empty.')
      return
    }
    const missing = cart.filter(i => i.product.serial_required && !i.serial_number)
    if (missing.length > 0) {
      toast.error(`Select serial for: ${missing.map(i => i.product.name).join(', ')}`)
      return
    }
    sessionStorage.setItem('pos_checkout_cart', JSON.stringify(cart))
    sessionStorage.setItem('pos_checkout_customer', customer ? JSON.stringify(customer) : '')
    router.push('/billing/checkout')
  }

  const totals = cartTotals(cart)
  const sortedCart = [...cart].sort((a, b) => {
    const aGst = a.is_taxable && a.product.gst_rate > 0 ? 1 : 0
    const bGst = b.is_taxable && b.product.gst_rate > 0 ? 1 : 0
    return bGst - aGst
  })

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-0">
      {/* Left: Cart */}
      <div className="flex-1 min-w-0 space-y-4">
        <ProductSearch products={products} onAdd={addProduct} />
        <div id="barcode-status" className="h-4 text-xs" />

        {cart.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <ShoppingCartIcon className="size-8 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">Cart is empty</p>
            <p className="text-sm text-slate-500 mt-1">Search for a product above to start billing</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            {/* Mobile: compact cart cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sortedCart.map(item => (
                <div key={item._id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 leading-tight">{item.product.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.product.sku}</p>
                      {item.product.serial_required && (
                        <button
                          type="button"
                          onClick={() => pickSerial(item._id)}
                          className={`mt-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
                            item.serial_number
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-red-200 bg-red-50 text-red-600'
                          }`}
                        >
                          {item.serial_number ? `S/N: ${item.serial_number}` : '⚠ Pick serial'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-sm text-slate-900 tabular-nums">₹{item.total.toFixed(2)}</p>
                      <button type="button" onClick={() => removeItem(item._id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(item._id, Math.max(1, item.quantity - 1))} className="size-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 font-bold text-sm">−</button>
                      <input
                        type="number"
                        value={item.quantity}
                        min={1}
                        onChange={e => updateQty(item._id, Math.max(1, parseInt(e.target.value) || 1))}
                        onFocus={e => e.target.select()}
                        className="w-10 text-center text-sm font-semibold border border-slate-200 rounded-lg h-7 bg-white outline-none focus:ring-2 focus:ring-slate-900/20"
                      />
                      <button type="button" onClick={() => updateQty(item._id, item.quantity + 1)} className="size-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 font-bold text-sm">+</button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        value={item.rate}
                        min={0}
                        step={0.01}
                        onChange={e => updateRate(item._id, parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="w-24 pl-5 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateDiscountMode(item._id, item.discount_mode === 'percent' ? 'flat' : 'percent')}
                        className="h-7 w-7 text-xs rounded-lg border border-slate-200 bg-white font-semibold text-slate-600"
                      >{item.discount_mode === 'percent' ? '%' : '₹'}</button>
                      <input
                        type="number"
                        value={item.discount_raw}
                        min={0}
                        onChange={e => updateDiscountRaw(item._id, parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                    {item.is_taxable && item.total_gst > 0 && (
                      <span className="text-xs text-slate-400">GST {item.product.gst_rate}%: ₹{item.total_gst.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Disc.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">GST%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCart.map(item => (
                  <CartItemRow
                    key={item._id}
                    item={item}
                    onQtyChange={updateQty}
                    onRateChange={updateRate}
                    onDiscountChange={updateDiscountRaw}
                    onDiscountModeChange={updateDiscountMode}
                    onRemove={removeItem}
                    onPickSerial={pickSerial}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</p>
          <CustomerSelector
            customers={customers}
            selected={customer}
            onSelect={handleCustomerChange}
          />
          {customer && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
              <p className="text-xs text-slate-500 font-medium">
                {customer.state} → {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
              </p>
            </div>
          )}
          {creditStatus && creditStatus.credit_limit > 0 && (
            <div className={`rounded-xl p-3 text-sm ${creditStatus.over_limit ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`font-semibold ${creditStatus.over_limit ? 'text-red-700' : 'text-amber-700'}`}>
                {creditStatus.over_limit ? '⚠ Credit limit exceeded' : 'Credit info'}
              </p>
              <p className="text-xs mt-0.5 text-slate-600">
                Outstanding: ₹{creditStatus.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Limit: ₹{creditStatus.credit_limit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>

        <CartSummary
          taxable_amount={totals.taxable_amount}
          cgst={totals.cgst}
          sgst={totals.sgst}
          igst={totals.igst}
          total_gst={totals.total_gst}
          grand_total={totals.grand_total}
          itemCount={cart.length}
          discount={totals.discount}
          non_taxable_items={totals.non_taxable_items}
        />

        <button
          type="button"
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="w-full h-14 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2.5"
        >
          <ShoppingCartIcon className="size-5" />
          Proceed to Checkout
          <ArrowRightIcon className="size-4" />
        </button>
      </div>

      {serialPickTarget && (() => {
        const item = cart.find(i => i._id === serialPickTarget)
        return item ? (
          <SerialPicker
            product={item.product}
            onSelect={handleSerialSelect}
            onClose={() => setSerialPickTarget(null)}
          />
        ) : null
      })()}
    </div>
  )
}
