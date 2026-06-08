'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function ForgotPinForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/set-pin')
        router.refresh()
      } else {
        setError(data.error || 'Verification failed')
        setLoading(false)
      }
    } catch {
      setError('Network error. Try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Your Email</label>
        <input
          id="email" type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
      </div>
      <div>
        <label htmlFor="recovery" className="block text-sm font-medium text-slate-700 mb-1">Recovery Password</label>
        <p className="text-xs text-slate-400 mb-1.5">The password your admin gave you when creating your account.</p>
        <input
          id="recovery" type="password" required value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full h-11 bg-[#111827] hover:bg-[#1F2937] text-white font-semibold rounded-xl transition-all disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify & Set New PIN'}
      </button>
      <div className="text-center">
        <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to login
        </Link>
      </div>
    </form>
  )
}
