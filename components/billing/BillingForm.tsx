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
import { PaymentModal } from './PaymentModal'
import { createInvoice } from '@/actions/invoices'
import { ShoppingCartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BillingFormProps {
  products: Product[]
  customers: Customer[]
}

export default function BillingForm({ products, customers }: BillingFormProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serialPickTarget, setSerialPickTarget] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
      const newItem: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total'> = {
        _id: crypto.randomUUID(),
        product,
        quantity: 1,
        rate: product.selling_price,
        discount: 0,
        serial_number: null,
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

  function updateDiscount(id: string, discount: number) {
    setCart(prev => prev.map(i => i._id === id ? recalcItem({ ...i, discount }, customerState) : i))
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

  const handleCustomerChange = useCallback((c: Customer | null) => {
    setCustomer(c)
    const state = c?.state ?? 'Telangana'
    setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
  }, [])

  function handleCheckout() {
    if (cart.length === 0) {
      toast.error('Cart is empty.')
      return
    }
    const missing = cart.filter(i => i.product.serial_required && !i.serial_number)
    if (missing.length > 0) {
      toast.error(`Select serial numbers for: ${missing.map(i => i.product.name).join(', ')}`)
      return
    }
    setPaymentOpen(true)
  }

  async function handleConfirmPayment(method: 'cash' | 'upi' | 'card') {
    const totals = cartTotals(cart)
    setSubmitting(true)
    try {
      const invoiceId = await createInvoice({
        customer_id: customer?.id ?? null,
        ...totals,
        payment_method: method,
        items: cart.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          sku: i.product.sku,
          hsn_code: i.product.hsn_code,
          serial_number: i.serial_number,
          quantity: i.quantity,
          rate: i.rate,
          discount: i.discount,
          gst_rate: i.product.gst_rate,
          taxable_amount: i.taxable_amount,
          cgst: i.cgst,
          sgst: i.sgst,
          igst: i.igst,
          total: i.total,
        })),
      })
      toast.success('Invoice saved!')
      setPaymentOpen(false)
      router.push(`/invoices/${invoiceId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  const totals = cartTotals(cart)

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      <div className="flex-1 min-w-0 space-y-4">
        <ProductSearch products={products} onAdd={addProduct} />

        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <ShoppingCartIcon className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Cart is empty. Search for a product to start billing.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rate</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Disc.</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">GST%</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <CartItemRow
                    key={item._id}
                    item={item}
                    onQtyChange={updateQty}
                    onRateChange={updateRate}
                    onDiscountChange={updateDiscount}
                    onRemove={removeItem}
                    onPickSerial={pickSerial}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</p>
          <CustomerSelector
            customers={customers}
            selected={customer}
            onSelect={handleCustomerChange}
          />
          {customer && (
            <p className="text-xs text-muted-foreground px-1">
              State: {customer.state} → GST: {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
            </p>
          )}
        </div>

        <CartSummary {...totals} itemCount={cart.length} />

        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleCheckout}
          disabled={cart.length === 0 || submitting}
        >
          Proceed to Payment
        </Button>
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

      {paymentOpen && (
        <PaymentModal
          grandTotal={totals.grand_total}
          onConfirm={handleConfirmPayment}
          onClose={() => setPaymentOpen(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}
