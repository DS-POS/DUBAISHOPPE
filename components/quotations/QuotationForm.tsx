'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Product, Customer } from '@/types/database'
import { type CartItem, recalcItem, cartTotals } from '@/components/billing/types'
import { ProductSearch } from '@/components/billing/ProductSearch'
import { CartItemRow } from '@/components/billing/CartItemRow'
import { CustomerSelector } from '@/components/billing/CustomerSelector'
import { CartSummary } from '@/components/billing/CartSummary'
import { createQuotation, updateQuotation } from '@/actions/quotations'
import type { CreateQuotationData } from '@/actions/quotations'
import type { QuotationItem } from '@/types/database'
import { createCustomerAndReturnId } from '@/actions/customers'
import type { StoreSettings } from '@/actions/settings'
import { FileTextIcon, SaveIcon, XIcon, BuildingIcon, UserPlusIcon } from 'lucide-react'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const emptyNewCust = { name: '', business_name: '', phone: '', email: '', gstin: '', address: '', state: 'Telangana' }

interface InitialQuotation {
  id: string
  customer_id: string | null
  customer: Customer | null
  quotation_date: string | null
  valid_until: string | null
  notes: string | null
  selected_bank_index: number | null
  items: QuotationItem[]
}

interface QuotationFormProps {
  products: Product[]
  customers: Customer[]
  settings: StoreSettings
  initialQuotation?: InitialQuotation
}

function buildInitialCart(items: QuotationItem[], products: Product[], customerState: string): CartItem[] {
  return items.map(item => {
    const product = products.find(p => p.id === item.product_id) ?? {
      id: item.product_id ?? '',
      name: item.product_name,
      sku: item.sku ?? '',
      barcode: null,
      category_id: null,
      brand: null,
      cost_price: item.rate,
      selling_price: item.rate,
      gst_rate: item.gst_rate,
      hsn_code: item.hsn_code,
      current_stock: 0,
      low_stock_alert: 0,
      serial_required: false,
      is_taxable: true,
      image_url: null,
      status: 'active' as const,
      created_at: '',
      updated_at: '',
    }
    return recalcItem({ _id: crypto.randomUUID(), product, quantity: item.quantity, rate: item.rate, discount_mode: 'flat', discount_raw: item.discount, serial_number: null, is_taxable: (item as unknown as { is_taxable?: boolean }).is_taxable ?? true }, customerState)
  })
}

export default function QuotationForm({ products, customers, settings, initialQuotation }: QuotationFormProps) {
  const router = useRouter()
  const isEdit = !!initialQuotation
  const initCustomerState = initialQuotation?.customer?.state ?? 'Telangana'
  const [cart, setCart] = useState<CartItem[]>(() =>
    initialQuotation ? buildInitialCart(initialQuotation.items, products, initCustomerState) : []
  )
  const [customer, setCustomer] = useState<Customer | null>(initialQuotation?.customer ?? null)
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers)
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCust, setNewCust] = useState({ ...emptyNewCust })
  const [savingCust, setSavingCust] = useState(false)
  const [selectedBankIndex, setSelectedBankIndex] = useState<number | null>(
    initialQuotation?.selected_bank_index ?? (settings.bank_accounts.length > 0 ? 0 : null)
  )
  const [quotationDate, setQuotationDate] = useState(
    initialQuotation?.quotation_date ?? new Date().toISOString().slice(0, 10)
  )

  const [validUntil, setValidUntil] = useState(initialQuotation?.valid_until ?? '')
  const [notes, setNotes] = useState(initialQuotation?.notes ?? '')
  const [saving, setSaving] = useState(false)

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

  const handleCustomerChange = useCallback((c: Customer | null) => {
    setCustomer(c)
    const state = c?.state ?? 'Telangana'
    setCart(prev => prev.map(i => recalcItem({ ...i }, state)))
  }, [])

  async function handleAddCustomer() {
    if (!newCust.name.trim()) { toast.error('Name is required'); return }
    setSavingCust(true)
    try {
      const id = await createCustomerAndReturnId({
        name: newCust.name,
        business_name: newCust.business_name || undefined,
        phone: newCust.phone || undefined,
        email: newCust.email || undefined,
        gstin: newCust.gstin || undefined,
        address: newCust.address || undefined,
        state: newCust.state || 'Telangana',
      })
      const created: Customer = {
        id,
        name: newCust.name.trim(),
        business_name: newCust.business_name.trim() || null,
        phone: newCust.phone.trim() || null,
        email: newCust.email.trim() || null,
        gstin: newCust.gstin.trim().toUpperCase() || null,
        address: newCust.address.trim() || null,
        state: newCust.state,
        credit_limit: 0,
        credit_days: 30,
        created_at: new Date().toISOString(),
      }
      setLocalCustomers(prev => [created, ...prev])
      handleCustomerChange(created)
      setAddingCustomer(false)
      setNewCust({ ...emptyNewCust })
      toast.success(`Customer "${created.name}" added`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add customer')
    } finally {
      setSavingCust(false)
    }
  }

  async function handleSave() {
    if (cart.length === 0) { toast.error('Cart is empty.'); return }
    setSaving(true)
    try {
      const totals = cartTotals(cart)
      const data: CreateQuotationData = {
        customer_id: customer?.id ?? null,
        ...totals,
        quotation_date: quotationDate || null,
        valid_until: validUntil || null,
        notes: notes || null,
        selected_bank_index: selectedBankIndex,
        items: cart.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          sku: i.product.sku,
          hsn_code: i.product.hsn_code,
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
      }
      if (isEdit) {
        await updateQuotation(initialQuotation!.id, data)
        toast.success('Quotation updated!')
        router.push(`/quotations/${initialQuotation!.id}`)
      } else {
        const id = await createQuotation(data)
        toast.success('Quotation saved!')
        router.push(`/quotations/${id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quotation')
    } finally {
      setSaving(false)
    }
  }

  const totals = cartTotals(cart)

  return (
    <div className="space-y-4">
      {/* Customer strip — always at top */}
      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</p>
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <CustomerSelector
                  customers={localCustomers}
                  selected={customer}
                  onSelect={c => { setAddingCustomer(false); handleCustomerChange(c) }}
                />
              </div>
              <button
                type="button"
                onClick={() => { setAddingCustomer(true); setNewCust({ ...emptyNewCust }) }}
                title="Add new customer"
                className="h-9 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all duration-150 shadow-sm"
              >
                <UserPlusIcon className="size-3.5" />
                New
              </button>
            </div>
            {customer && (
              <p className="text-xs text-slate-400 px-1">
                {customer.business_name ? `${customer.business_name} · ` : ''}
                State: {customer.state} → {customer.state === 'Telangana' ? 'CGST + SGST' : 'IGST'}
              </p>
            )}
          </div>

          {/* Bank selector — shown inline if multiple banks */}
          {settings.bank_accounts.length > 0 && (
            <div className="sm:w-64 shrink-0 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BuildingIcon className="size-3" />
                Bank Account for PDF
              </p>
              <div className="space-y-1.5">
                {settings.bank_accounts.map((b, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                      selectedBankIndex === i
                        ? 'border-slate-900 bg-slate-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bank_account"
                      checked={selectedBankIndex === i}
                      onChange={() => setSelectedBankIndex(i)}
                      className="accent-[#111827]"
                    />
                    <span className="text-xs">
                      <span className="font-semibold text-slate-800">{b.bank_name || `Account ${i + 1}`}</span>
                      {b.account_number && (
                        <span className="text-slate-400 ml-1">···{b.account_number.slice(-4)}</span>
                      )}
                    </span>
                  </label>
                ))}
                <label className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  selectedBankIndex === null ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="bank_account"
                    checked={selectedBankIndex === null}
                    onChange={() => setSelectedBankIndex(null)}
                    className="accent-[#111827]"
                  />
                  <span className="text-xs text-slate-500">No bank details</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Inline add customer form */}
        {addingCustomer && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">New Customer</span>
              <button type="button" onClick={() => setAddingCustomer(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'name', label: 'Name *' },
                { key: 'business_name', label: 'Business Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'gstin', label: 'GSTIN' },
                { key: 'address', label: 'Address' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">{label}</label>
                  <input
                    type="text"
                    value={newCust[key as keyof typeof newCust]}
                    onChange={e => setNewCust(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 h-8 text-xs outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-900"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">State</label>
                <select
                  value={newCust.state}
                  onChange={e => setNewCust(p => ({ ...p, state: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 h-8 text-xs outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-900"
                >
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setAddingCustomer(false)}
                className="px-4 h-8 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAddCustomer} disabled={savingCust}
                className="px-4 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                {savingCust ? 'Saving…' : 'Add & Select'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main: cart + sidebar */}
      <div className="flex flex-col lg:flex-row gap-5 min-h-0">
        {/* Left: Cart */}
        <div className="flex-1 min-w-0 space-y-4">
          <ProductSearch products={products} onAdd={addProduct} />
          {cart.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileTextIcon className="size-8 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">No items yet</p>
              <p className="text-sm text-slate-500 mt-1">Search for a product above to add to this quotation</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Disc.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">GST%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
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
                      onPickSerial={() => {}}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quotation Date</p>
            <input
              type="date"
              value={quotationDate}
              onChange={e => setQuotationDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valid Until</p>
            <input
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes for the customer…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all resize-none"
            />
          </div>
          <CartSummary {...totals} itemCount={cart.length} />
          <button
            type="button"
            onClick={handleSave}
            disabled={cart.length === 0 || saving}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl shadow-sm flex items-center justify-center gap-2"
          >
            <SaveIcon className="size-5" />
            {saving ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Quotation' : 'Save Quotation')}
          </button>
        </div>
      </div>
    </div>
  )
}
