'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SearchIcon, BanknoteIcon, SmartphoneIcon, CreditCardIcon, WalletIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type CartItem, cartTotals } from './types'
import { getCustomers, createCustomerAndReturnId } from '@/actions/customers'
import { createInvoice } from '@/actions/invoices'
import { queueOfflineInvoice } from '@/lib/offline/cache-sync'
import type { Customer } from '@/types/database'

const INDIAN_STATES = [
  'Telangana',
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Gujarat',
  'Rajasthan',
  'Delhi',
  'Uttar Pradesh',
  'West Bengal',
  'Kerala',
  'Other',
]

type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit'

interface CheckoutFormProps {
  initialCart: CartItem[]
  initialCustomer: Customer | null
  creditLimit?: number
  creditAvailable?: number
}

export function CheckoutForm({ initialCart, initialCustomer, creditLimit, creditAvailable }: CheckoutFormProps) {
  const router = useRouter()
  const cart = initialCart
  const totals = cartTotals(cart)

  // Customer fields
  const [customerName, setCustomerName] = useState(initialCustomer?.name ?? '')
  const [businessName, setBusinessName] = useState(initialCustomer?.business_name ?? '')
  const [phone, setPhone] = useState(initialCustomer?.phone ?? '')
  const [email, setEmail] = useState(initialCustomer?.email ?? '')
  const [address, setAddress] = useState(initialCustomer?.address ?? '')
  const [state, setState] = useState(initialCustomer?.state ?? 'Telangana')
  const [gstin, setGstin] = useState(initialCustomer?.gstin ?? '')
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(initialCustomer?.id ?? null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tendered = parseFloat(amountTendered) || 0
  const change = tendered - totals.grand_total

  function fillCustomer(c: Customer) {
    setCustomerName(c.name)
    setBusinessName(c.business_name ?? '')
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    setAddress(c.address ?? '')
    setState(c.state ?? 'Telangana')
    setGstin(c.gstin ?? '')
    setExistingCustomerId(c.id)
    setShowResults(false)
    setSearchQuery(c.name)
  }

  function clearCustomer() {
    setCustomerName('')
    setBusinessName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setState('Telangana')
    setGstin('')
    setExistingCustomerId(null)
    setSearchQuery('')
    setShowResults(false)
  }

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q)
    setExistingCustomerId(null)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await getCustomers(q)
        setSearchResults(results)
        setShowResults(true)
      } catch {
        // silently ignore
      }
    }, 300)
  }, [])

  async function handleSubmit() {
    if (!customerName.trim() && !phone.trim()) {
      // allow walk-in with no customer
    }

    setSubmitting(true)
    try {
      let customerId: string | null = existingCustomerId

      // If user typed customer info but didn't select existing, create new
      if (!existingCustomerId && (customerName.trim() || phone.trim())) {
        // Check if customer with same phone already exists
        if (phone.trim()) {
          const existing = await getCustomers(phone.trim())
          const match = existing.find(c => c.phone?.trim() === phone.trim())
          if (match) {
            customerId = match.id
          }
        }
        if (!customerId && customerName.trim()) {
          customerId = await createCustomerAndReturnId({
            name: customerName.trim() || 'Walk-in Customer',
            business_name: businessName.trim() || undefined,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            address: address.trim() || undefined,
            gstin: gstin.trim() || undefined,
            state: state || 'Telangana',
          })
        }
      }

      const amountPaid = paymentMethod === 'cash' && amountTendered
        ? parseFloat(amountTendered) || totals.grand_total
        : totals.grand_total

      const invoicePayload = {
        customer_id: customerId,
        ...totals,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
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
          is_taxable: i.is_taxable,
          taxable_amount: i.taxable_amount,
          cgst: i.cgst,
          sgst: i.sgst,
          igst: i.igst,
          total: i.total,
        })),
      }

      try {
        const invoiceId = await createInvoice(invoicePayload)
        sessionStorage.removeItem('pos_checkout_cart')
        sessionStorage.removeItem('pos_checkout_customer')
        toast.success('Invoice created!')
        router.push(`/invoices/${invoiceId}`)
        return
      } catch (err) {
        const isNetworkError =
          err instanceof TypeError && err.message.toLowerCase().includes('fetch')
        if (!isNetworkError) throw err
        // Network offline — queue locally
      }

      const tempNo = await queueOfflineInvoice(invoicePayload)
      sessionStorage.removeItem('pos_checkout_cart')
      sessionStorage.removeItem('pos_checkout_customer')
      toast.success(`Offline: Invoice ${tempNo} saved locally. Will sync when online.`, { duration: 6000 })
      router.push('/billing')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cart Summary */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cart Summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Rate</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Disc.</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium">{item.product.name}</p>
                    {item.serial_number && (
                      <p className="text-xs text-muted-foreground">S/N: {item.serial_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">₹{item.rate.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600">
              <span>Discount</span><span>−₹{totals.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Taxable</span><span>₹{totals.taxable_amount.toFixed(2)}</span>
          </div>
          {totals.cgst > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>CGST</span><span>₹{totals.cgst.toFixed(2)}</span>
            </div>
          )}
          {totals.sgst > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SGST</span><span>₹{totals.sgst.toFixed(2)}</span>
            </div>
          )}
          {totals.igst > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IGST</span><span>₹{totals.igst.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1 border-t border-border mt-1">
            <span>Grand Total</span><span>₹{totals.grand_total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Customer Section */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
        </div>
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button variant="outline" size="sm" type="button" onClick={clearCustomer}>
                New
              </Button>
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-muted-foreground ml-2">{c.phone}</span>}
                    {c.business_name && <span className="text-muted-foreground ml-2">— {c.business_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); setExistingCustomerId(null) }}
                placeholder="Customer name"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={e => { setBusinessName(e.target.value); setExistingCustomerId(null) }}
                placeholder="Business / Company"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone <span className="text-destructive">*</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setExistingCustomerId(null) }}
                placeholder="10-digit mobile"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setExistingCustomerId(null) }}
                placeholder="email@example.com"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={e => { setAddress(e.target.value); setExistingCustomerId(null) }}
                placeholder="Street, City"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">State</label>
              <select
                value={state}
                onChange={e => { setState(e.target.value); setExistingCustomerId(null) }}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={e => { setGstin(e.target.value.toUpperCase()); setExistingCustomerId(null) }}
                placeholder="GST number"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Method</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {([
              { value: 'cash' as const, label: 'Cash', icon: <BanknoteIcon className="size-5" /> },
              { value: 'upi' as const, label: 'UPI', icon: <SmartphoneIcon className="size-5" /> },
              { value: 'card' as const, label: 'Card', icon: <CreditCardIcon className="size-5" /> },
              { value: 'credit' as const, label: 'Credit', icon: <WalletIcon className="size-5" /> },
            ]).map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={[
                  'flex flex-col items-center gap-2 py-3 rounded-lg border text-xs font-medium transition-colors',
                  paymentMethod === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'credit' && creditAvailable !== undefined && totals.grand_total > creditAvailable && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold">Credit limit exceeded</p>
                <p>Order ₹{totals.grand_total.toFixed(2)} exceeds available credit of ₹{creditAvailable.toFixed(2)}.</p>
              </div>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Amount Tendered</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <input
                  type="number"
                  value={amountTendered}
                  min={0}
                  step={0.01}
                  onChange={e => setAmountTendered(e.target.value)}
                  placeholder={totals.grand_total.toFixed(2)}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {tendered > 0 && change >= 0 && (
                <p className="text-sm font-medium text-emerald-600">
                  Change: ₹{change.toFixed(2)}
                </p>
              )}
              {tendered > 0 && change < 0 && (
                <p className="text-sm font-medium text-amber-600">
                  Balance Due: ₹{Math.abs(change).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Button
          variant="outline"
          className="flex-1"
          type="button"
          onClick={() => router.push('/billing')}
          disabled={submitting}
        >
          ← Cancel
        </Button>
        <Button
          className="flex-1 h-12 text-base font-semibold"
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creating Invoice…' : 'Create Invoice'}
        </Button>
      </div>
    </div>
  )
}
