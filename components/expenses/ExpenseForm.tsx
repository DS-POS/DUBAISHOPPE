'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createExpense, type CreateExpenseData } from '@/actions/expenses'
import type { ExpenseCategory } from '@/types/database'

interface ExpenseFormProps {
  categories: ExpenseCategory[]
}

export function ExpenseForm({ categories }: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateExpenseData>({
    date: new Date().toISOString().slice(0, 10),
    category_id: categories[0]?.id ?? '',
    amount: 0,
    description: '',
    payment_method: 'cash',
    reference_no: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category_id) { toast.error('Select a category'); return }
    if (!form.amount || form.amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.description.trim()) { toast.error('Enter a description'); return }
    setLoading(true)
    try {
      await createExpense({ ...form, amount: Number(form.amount) })
      toast.success('Expense recorded')
      router.push('/expenses')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Category</label>
          <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white" required>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Description</label>
        <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly salary for June" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Amount (₹)</label>
          <input type="number" value={form.amount || ''} min={0.01} step={0.01} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} onFocus={e => e.target.select()} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Payment Method</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as CreateExpenseData['payment_method'] }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Reference No. <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="text" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} placeholder="Cheque no., UPI ref, etc." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-semibold hover:bg-[#1F2937] disabled:opacity-50 transition-colors">{loading ? 'Saving...' : 'Save Expense'}</button>
      </div>
    </form>
  )
}
