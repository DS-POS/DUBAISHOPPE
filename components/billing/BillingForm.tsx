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

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-0">
      {/* Left: Cart */}
      <div className="flex-1 min-w-0 space-y-4">
        <ProductSearch products={products} onAdd={addProduct} />

        {cart.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingCartIcon className="size-8 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">Cart is empty</p>
            <p className="text-sm text-slate-500 mt-1">Search for a product above to start billing</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
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
                {cart.map(item => (
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
      <div className="w-full lg:w-[320px] shrink-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</p>
          <CustomerSelector
            customers={customers}
            selected={customer}
            onSelect={handleCustomerChange}
          />
          {customer && (
            <p className="text-xs text-slate-400 px-1">
              State: {customer.state} → GST: {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
            </p>
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
          className="w-full h-14 bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-2xl shadow-lg shadow-slate-900/25 transition-all duration-200 flex items-center justify-center gap-2.5 ring-1 ring-white/[0.08]"
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
