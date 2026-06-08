'use client'

import { useState } from 'react'
import Link from 'next/link'

export function ForgotPinForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSent(true)
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-[#111827] text-lg">Check your email</h3>
          <p className="text-sm text-slate-500 mt-1">
            We sent a PIN reset link to <span className="font-semibold text-slate-700">{email}</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">Click the link in the email to set a new PIN. Link expires in 1 hour.</p>
        </div>
        <Link href="/login" className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Your Email</label>
        <p className="text-xs text-slate-400 mb-2">Enter the email your admin registered for your account. We will send a PIN reset link.</p>
        <input
          id="email" type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
        />
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full h-11 bg-[#111827] hover:bg-[#1F2937] text-white font-semibold rounded-xl transition-all disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send PIN Reset Link'}
      </button>
      <div className="text-center">
        <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to login
        </Link>
      </div>
    </form>
  )
}
