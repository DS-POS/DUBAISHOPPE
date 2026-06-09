'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createStaffUser } from '@/actions/users'
import type { UserRole } from '@/types/database'
import { XIcon, UserPlusIcon } from 'lucide-react'

export function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'cashier' as UserRole,
    pin: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createStaffUser(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${form.name} added successfully`)
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-lg text-[#111827]">Add Staff Member</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XIcon className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ahmed Ali"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <p className="text-xs text-slate-400 mb-1.5">Staff uses this email to receive a PIN reset link if they forget their PIN.</p>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="staff@dubaishoppe.com"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 bg-white"
            >
              <option value="cashier">Cashier — Sales only</option>
              <option value="manager">Manager — Sales, stock, reports</option>
              <option value="staff">Staff — Sales only</option>
              <option value="admin">Admin — Full access</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial PIN (4 digits)</label>
            <input
              type="text" inputMode="numeric" maxLength={4} required
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="1234"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-center tracking-widest outline-none focus:ring-2 focus:ring-[#111827]/20"
            />
            <p className="text-xs text-slate-400 mt-1">Tell staff this PIN in person. They can change it anytime via Forgot PIN.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending || form.pin.length !== 4}
              className="flex-1 h-10 rounded-xl bg-[#111827] text-white text-sm font-semibold hover:bg-[#1F2937] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlusIcon className="size-4" />
              {isPending ? 'Creating…' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
