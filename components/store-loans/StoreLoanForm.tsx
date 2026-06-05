'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStoreLoan, type CreateStoreLoanData } from '@/actions/store-loans'
import type { StoreLoanDirection } from '@/types/database'

export function StoreLoanForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateStoreLoanData>({
    direction: 'lent_out',
    store_name: '',
    person_name: '',
    product_name: '',
    quantity: 1,
    price: null,
    loan_date: new Date().toISOString().slice(0, 10),
    expected_return_date: null,
    notes: null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.store_name.trim()) { toast.error('Enter store name'); return }
    if (!form.person_name.trim()) { toast.error('Enter person name'); return }
    if (!form.product_name.trim()) { toast.error('Enter product name'); return }
    if (form.quantity < 1) { toast.error('Quantity must be at least 1'); return }
    setLoading(true)
    try {
      const loan = await createStoreLoan(form)
      toast.success('Loan recorded')
      router.push(`/store-loans/${loan.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const directionOptions: { value: StoreLoanDirection; label: string; desc: string }[] = [
    { value: 'lent_out', label: 'Lent Out', desc: 'We gave an item to another store — they will return it' },
    { value: 'borrowed_in', label: 'Borrowed In', desc: 'We took an item from another store — we will return it' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">

      {/* Direction */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Direction</label>
        <div className="grid grid-cols-2 gap-3">
          {directionOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, direction: opt.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                form.direction === opt.value
                  ? opt.value === 'lent_out'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className={`text-sm font-semibold ${
                form.direction === opt.value
                  ? opt.value === 'lent_out' ? 'text-amber-800' : 'text-blue-800'
                  : 'text-slate-700'
              }`}>{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Store + Person */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            {form.direction === 'lent_out' ? 'Their Store Name' : 'Source Store Name'}
          </label>
          <input
            type="text"
            value={form.store_name}
            onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
            placeholder="e.g. SR Store, City Camera"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Person Name</label>
          <input
            type="text"
            value={form.person_name}
            onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
            placeholder="Who came / who you went to"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
      </div>

      {/* Product */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Product / Item</label>
        <input
          type="text"
          value={form.product_name}
          onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
          placeholder="e.g. Canon 50mm f/1.8, Sony A7 III body"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          required
        />
      </div>

      {/* Qty + Price */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Qty</label>
          <input
            type="number"
            min={1}
            step={1}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
            onFocus={e => e.target.select()}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Price (&#8377;) <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.price ?? ''}
            onChange={e => setForm(f => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : null }))}
            onFocus={e => e.target.select()}
            placeholder="Estimated item value"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Loan Date</label>
          <input
            type="date"
            value={form.loan_date}
            onChange={e => setForm(f => ({ ...f, loan_date: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Expected Return <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={form.expected_return_date ?? ''}
            onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value || null }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.notes ?? ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
          placeholder="Any additional details..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-semibold hover:bg-[#1F2937] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Record Loan'}
        </button>
      </div>
    </form>
  )
}
