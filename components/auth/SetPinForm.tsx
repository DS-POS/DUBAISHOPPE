'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setMyPin } from '@/actions/users'
import { toast } from 'sonner'

export function SetPinForm() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) {
      toast.error('PIN must be exactly 4 digits')
      return
    }
    if (pin !== confirm) {
      toast.error('PINs do not match')
      return
    }
    setLoading(true)
    try {
      await setMyPin(pin)
      toast.success('PIN updated successfully!')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set PIN')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">New PIN (4 digits)</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm text-center tracking-widest text-lg outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirm}
          onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm text-center tracking-widest text-lg outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
      </div>
      <button
        type="submit" disabled={loading || pin.length !== 4 || confirm.length !== 4}
        className="w-full h-11 bg-[#111827] hover:bg-[#1F2937] text-white font-semibold rounded-xl transition-all disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Set New PIN'}
      </button>
    </form>
  )
}
