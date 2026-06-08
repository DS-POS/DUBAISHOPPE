'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  SearchIcon, BanknoteIcon, SmartphoneIcon, CreditCardIcon,
  WalletIcon, BuildingIcon, ShoppingCartIcon, UserIcon,
  CreditCardIcon as PayIcon, FileTextIcon, ShieldCheckIcon,
  ChevronDownIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type CartItem, cartTotals } from './types'
import { getCustomers, createCustomerAndReturnId } from '@/actions/customers'
import { createInvoice } from '@/actions/invoices'
import { queueOfflineInvoice } from '@/lib/offline/cache-sync'
import type { Customer } from '@/types/database'

const INDIAN_STATES = [
  'Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat',
  'Rajasthan', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Kerala', 'Other',
]

type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit' | 'insurance'

interface CheckoutFormProps {
  initialCart: CartItem[]
  initialCustomer: Customer | null
  creditLimit?: number
  creditAvailable?: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CheckoutForm({ initialCart, initialCustomer, creditLimit, creditAvailable }: CheckoutFormProps) {
  const router = useRouter()
  const cart = initialCart
  const totals = cartTotals(cart)
  const sortedCart = [...cart].sort((a, b) => {
    const aGst = a.is_taxable && a.product.gst_rate > 0 ? 1 : 0
    const bGst = b.is_taxable && b.product.gst_rate > 0 ? 1 : 0
    return bGst - aGst
  })

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
  const [loadingAll, setLoadingAll] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function dedupeCustomers(list: Customer[]): Customer[] {
    const seen = new Set<string>()
    return list.filter(c => {
      const key = `${c.name.trim().toLowerCase()}|${(c.phone ?? '').trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [creditAmountReceived, setCreditAmountReceived] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [insuranceCompany, setInsuranceCompany] = useState('')
  const [insuranceClaimNo, setInsuranceClaimNo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tendered = parseFloat(amountTendered) || 0

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
        setSearchResults(dedupeCustomers(results))
        setShowResults(true)
      } catch {
        // silently ignore
      }
    }, 300)
  }, [])

  async function handleShowAll() {
    setLoadingAll(true)
    try {
      const all = await getCustomers('')
      setSearchResults(dedupeCustomers(all))
      setShowResults(true)
    } catch {
      // silently ignore
    } finally {
      setLoadingAll(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      let customerId: string | null = existingCustomerId

      if (!existingCustomerId && (customerName.trim() || phone.trim())) {
        if (phone.trim()) {
          const existing = await getCustomers(phone.trim())
          const match = existing.find(c => c.phone?.trim() === phone.trim())
          if (match) customerId = match.id
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

      let amountPaid: number
      let reference: string | undefined

      if (paymentMethod === 'credit') {
        const received = parseFloat(creditAmountReceived) || 0
        amountPaid = Math.min(received, totals.grand_total)
        reference = creditNote.trim() || undefined
      } else {
        const tenderedAmt = parseFloat(amountTendered) || 0
        amountPaid = tenderedAmt > 0
          ? Math.min(tenderedAmt, totals.grand_total)
          : totals.grand_total
        reference = paymentReference || undefined
      }

      const invoicePayload = {
        customer_id: customerId,
        ...totals,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        payment_reference: reference,
        ...(paymentMethod === 'insurance' && {
          insurance_company: insuranceCompany.trim() || undefined,
          insurance_claim_no: insuranceClaimNo.trim() || undefined,
        }),
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
        const invoiceIds = await createInvoice(invoicePayload)
        sessionStorage.removeItem('pos_checkout_cart')
        sessionStorage.removeItem('pos_checkout_customer')
        if (invoiceIds.length === 2) {
          toast.success('2 invoices created: Tax Invoice + Bill of Supply', { duration: 5000 })
        } else {
          toast.success('Invoice created!')
        }
        router.push(`/invoices/${invoiceIds[0]}`)
        return
      } catch (err) {
        const isNetworkError =
          err instanceof TypeError && err.message.toLowerCase().includes('fetch')
        if (!isNetworkError) throw err
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

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400'
  const sectionHeaderCls = 'flex items-center gap-2.5 px-5 py-3.5'

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Cart Summary */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className={`${sectionHeaderCls} bg-gradient-to-r from-slate-800 to-slate-700`}>
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <ShoppingCartIcon className="size-4 text-white" />
          </div>
          <p className="text-sm font-bold text-white">Cart Summary</p>
          <span className="ml-auto text-xs font-semibold text-slate-300 bg-white/10 px-2.5 py-1 rounded-full">
            {cart.length} item{cart.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Mobile: cart item cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {sortedCart.map(item => (
            <div key={item._id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-900 leading-tight">{item.product.name}</p>
                  {item.serial_number && <p className="text-xs text-slate-400 mt-0.5">S/N: {item.serial_number}</p>}
                </div>
                <p className="font-bold text-sm text-slate-900 tabular-nums shrink-0">₹{item.total.toFixed(2)}</p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                <span>Qty: <b>{item.quantity}</b></span>
                <span>Rate: ₹{item.rate.toFixed(2)}</span>
                {item.discount > 0 && <span>Disc: ₹{item.discount.toFixed(2)}</span>}
                {item.is_taxable && item.total_gst > 0 && (
                  <span className="text-blue-600">GST {item.product.gst_rate}%{item.cgst > 0 ? ` · CGST ₹${item.cgst.toFixed(2)}` : ''}{item.sgst > 0 ? ` · SGST ₹${item.sgst.toFixed(2)}` : ''}{item.igst > 0 ? ` · IGST ₹${item.igst.toFixed(2)}` : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc.</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCart.map(item => (
                <>
                  <tr key={item._id}>
                    <td className="px-4 pt-3 pb-1">
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      {item.serial_number && (
                        <p className="text-xs text-slate-400 mt-0.5">S/N: {item.serial_number}</p>
                      )}
                    </td>
                    <td className="px-4 pt-3 pb-1 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-4 pt-3 pb-1 text-right text-slate-700">₹{item.rate.toFixed(2)}</td>
                    <td className="px-4 pt-3 pb-1 text-right text-slate-400">
                      {item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 pt-3 pb-1 text-right font-semibold text-slate-900">₹{item.total.toFixed(2)}</td>
                  </tr>
                  {item.is_taxable && item.total_gst > 0 && (
                    <tr key={`${item._id}-gst`} className="bg-blue-50/40">
                      <td colSpan={5} className="px-4 pb-2 pt-0">
                        <p className="text-xs text-blue-700 font-medium">
                          {`Taxable: ₹${item.taxable_amount.toFixed(2)} · GST ${item.product.gst_rate}%${item.cgst > 0 ? ` · CGST: ₹${item.cgst.toFixed(2)}` : ''}${item.sgst > 0 ? ` · SGST: ₹${item.sgst.toFixed(2)}` : ''}${item.igst > 0 ? ` · IGST: ₹${item.igst.toFixed(2)}` : ''}`}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600">
              <span>Discount</span><span>−₹{totals.discount.toFixed(2)}</span>
            </div>
          )}
          {totals.taxable_amount > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Taxable Amount</span><span>₹{totals.taxable_amount.toFixed(2)}</span>
            </div>
          )}
          {totals.total_gst > 0 && (
            <>
              <div className="flex justify-between text-xs font-semibold text-blue-700">
                <span>Total GST</span><span>₹{totals.total_gst.toFixed(2)}</span>
              </div>
              {totals.cgst > 0 && (
                <div className="flex justify-between text-xs text-slate-400 pl-3">
                  <span>↳ CGST</span><span>₹{totals.cgst.toFixed(2)}</span>
                </div>
              )}
              {totals.sgst > 0 && (
                <div className="flex justify-between text-xs text-slate-400 pl-3">
                  <span>↳ SGST</span><span>₹{totals.sgst.toFixed(2)}</span>
                </div>
              )}
              {totals.igst > 0 && (
                <div className="flex justify-between text-xs text-slate-400 pl-3">
                  <span>↳ IGST</span><span>₹{totals.igst.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between items-center font-black bg-gradient-to-r from-slate-800 to-slate-700 text-white -mx-5 px-5 py-4 mt-2 rounded-b-xl">
            <span className="text-base">Grand Total</span>
            <span className="text-2xl">₹{totals.grand_total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Customer Section */}
      <div className="rounded-2xl border border-blue-200 overflow-hidden shadow-sm">
        <div className={`${sectionHeaderCls} bg-gradient-to-r from-blue-600 to-blue-700`}>
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <UserIcon className="size-4 text-white" />
          </div>
          <p className="text-sm font-bold text-white">Customer Details</p>
          <span className="ml-auto text-xs text-blue-200">Optional for walk-in</span>
        </div>
        <div className="p-5 space-y-4 bg-white">
          {/* Search */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className={`${inputCls} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => showResults ? setShowResults(false) : handleShowAll()}
                  disabled={loadingAll}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Browse all customers"
                >
                  <ChevronDownIcon className={`size-4 transition-transform ${showResults ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <button
                type="button"
                onClick={clearCustomer}
                className="px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors"
              >
                New
              </button>
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-y-auto">
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm border-b border-slate-50 last:border-0"
                  >
                    <span className="font-semibold text-slate-900">{c.name}</span>
                    {c.phone && <span className="text-slate-400 ml-2 text-xs">{c.phone}</span>}
                    {c.business_name && <span className="text-slate-400 ml-2 text-xs">— {c.business_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setExistingCustomerId(null) }} placeholder="Customer name" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business Name</label>
              <input type="text" value={businessName} onChange={e => { setBusinessName(e.target.value); setExistingCustomerId(null) }} placeholder="Business / Company" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
              <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setExistingCustomerId(null) }} placeholder="10-digit mobile" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setExistingCustomerId(null) }} placeholder="email@example.com" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address</label>
              <input type="text" value={address} onChange={e => { setAddress(e.target.value); setExistingCustomerId(null) }} placeholder="Street, City" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">State</label>
              <select value={state} onChange={e => { setState(e.target.value); setExistingCustomerId(null) }} className={inputCls}>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">GSTIN</label>
              <input type="text" value={gstin} onChange={e => { setGstin(e.target.value.toUpperCase()); setExistingCustomerId(null) }} placeholder="GST number" className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="rounded-2xl border border-violet-200 overflow-hidden shadow-sm">
        <div className={`${sectionHeaderCls} bg-gradient-to-r from-violet-600 to-purple-700`}>
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <PayIcon className="size-4 text-white" />
          </div>
          <p className="text-sm font-bold text-white">Payment Method</p>
        </div>
        <div className="p-5 space-y-4 bg-white">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {([
              { value: 'cash' as const, label: 'Cash', icon: <BanknoteIcon className="size-5" />, color: null },
              { value: 'upi' as const, label: 'UPI', icon: <SmartphoneIcon className="size-5" />, color: null },
              { value: 'card' as const, label: 'Card', icon: <CreditCardIcon className="size-5" />, color: null },
              { value: 'bank_transfer' as const, label: 'Bank', icon: <BuildingIcon className="size-5" />, color: null },
              { value: 'credit' as const, label: 'Credit', icon: <WalletIcon className="size-5" />, color: 'violet' },
              { value: 'insurance' as const, label: 'Insurance', icon: <ShieldCheckIcon className="size-5" />, color: 'blue' },
            ]).map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={[
                  'flex flex-col items-center gap-2 py-3.5 rounded-xl border-2 text-xs font-semibold transition-all',
                  paymentMethod === m.value
                    ? m.color === 'violet'
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : m.color === 'blue'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-800 bg-slate-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Credit mode warning */}
          {paymentMethod === 'credit' && creditAvailable !== undefined && totals.grand_total > creditAvailable && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-800 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
              <div>
                <p className="font-semibold">Credit limit exceeded</p>
                <p className="text-xs mt-0.5">Order ₹{totals.grand_total.toFixed(2)} exceeds available credit of ₹{creditAvailable.toFixed(2)}.</p>
              </div>
            </div>
          )}

          {/* Credit fields */}
          {paymentMethod === 'credit' && (
            <div className="space-y-3 rounded-xl bg-violet-50 border border-violet-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileTextIcon className="size-4 text-violet-600" />
                <p className="text-xs font-bold text-violet-800 uppercase tracking-wide">Credit Record</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-violet-700 mb-1.5">
                    Amount Received Now <span className="font-normal text-violet-500">(partial, if any)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                    <input
                      type="number"
                      value={creditAmountReceived}
                      min={0}
                      step={0.01}
                      onChange={e => setCreditAmountReceived(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                  {creditAmountReceived && parseFloat(creditAmountReceived) > 0 && (
                    <p className="text-xs text-violet-600 font-medium mt-1">
                      Balance due: ₹{Math.max(0, totals.grand_total - (parseFloat(creditAmountReceived) || 0)).toFixed(2)}
                    </p>
                  )}
                  {!creditAmountReceived && (
                    <p className="text-xs text-violet-500 mt-1">
                      Leave blank → full ₹{totals.grand_total.toFixed(2)} marked as due
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-violet-700 mb-1.5">
                    Note <span className="font-normal text-violet-500">(item given, customer detail)</span>
                  </label>
                  <input
                    type="text"
                    value={creditNote}
                    onChange={e => setCreditNote(e.target.value)}
                    placeholder="e.g. Canon EOS given on credit to Malik"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Insurance fields */}
          {paymentMethod === 'insurance' && (
            <div className="space-y-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheckIcon className="size-4 text-blue-600" />
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Insurance Details</p>
              </div>
              <p className="text-xs text-blue-600">Insurer deposits claim amount to store bank. Customer collects item against claim.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1.5">Insurance Company</label>
                  <input
                    type="text"
                    value={insuranceCompany}
                    onChange={e => setInsuranceCompany(e.target.value)}
                    placeholder="e.g. Bajaj Allianz, HDFC Ergo"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1.5">Claim / Policy Number</label>
                  <input
                    type="text"
                    value={insuranceClaimNo}
                    onChange={e => setInsuranceClaimNo(e.target.value)}
                    placeholder="e.g. CLM-2024-001234"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Non-credit payment fields */}
          {paymentMethod !== 'credit' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Amount Tendered <span className="font-normal text-slate-400">(leave blank = fully paid)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    type="number"
                    value={amountTendered}
                    min={0}
                    step={0.01}
                    onChange={e => setAmountTendered(e.target.value)}
                    placeholder={totals.grand_total.toFixed(2)}
                    className={`${inputCls} pl-7`}
                  />
                </div>
                {tendered > 0 && tendered >= totals.grand_total && (
                  <p className="text-sm font-semibold text-emerald-600 mt-1">
                    {paymentMethod === 'cash' ? `Change: ₹${(tendered - totals.grand_total).toFixed(2)}` : 'Fully paid'}
                  </p>
                )}
                {tendered > 0 && tendered < totals.grand_total && (
                  <p className="text-sm font-semibold text-amber-600 mt-1">
                    Balance Due: ₹{(totals.grand_total - tendered).toFixed(2)} — invoice marked pending
                  </p>
                )}
              </div>
              {paymentMethod !== 'cash' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {paymentMethod === 'upi' ? 'UPI Reference / UTR' :
                     paymentMethod === 'card' ? 'Approval Code' :
                     'Transfer Reference'}{' '}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    placeholder={
                      paymentMethod === 'upi' ? 'e.g. 123456789012' :
                      paymentMethod === 'card' ? 'e.g. 123456' :
                      'e.g. NEFT/RTGS ref'
                    }
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Button
          variant="outline"
          className="flex-1 h-12 text-sm font-semibold rounded-xl"
          type="button"
          onClick={() => router.push('/billing')}
          disabled={submitting}
        >
          ← Cancel
        </Button>
        <Button
          className="flex-1 h-12 text-base font-bold rounded-xl bg-slate-900 hover:bg-slate-800"
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creating Invoice…' : 'Create Invoice →'}
        </Button>
      </div>
    </div>
  )
}
