'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StaffProfile {
  id: string
  name: string
  role: string
}

interface Props {
  profiles: StaffProfile[]
  onAdminLogin: () => void
}

export function PinLogin({ profiles, onAdminLogin }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<StaffProfile | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pin.length === 4 && selected && !loading) {
      submitPin()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  function handleDigit(d: string) {
    if (loading || pin.length >= 4) return
    setError('')
    setPin(p => p + d)
  }

  function handleBackspace() {
    if (loading) return
    setError('')
    setPin(p => p.slice(0, -1))
  }

  async function submitPin() {
    if (!selected || pin.length !== 4) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selected.id, pin }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(data.error || 'Incorrect PIN')
        setPin('')
        setLoading(false)
      }
    } catch {
      setError('Network error. Try again.')
      setPin('')
      setLoading(false)
    }
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      cashier: 'Cashier',
      staff: 'Staff',
    }
    return labels[role] ?? role
  }

  function getRoleColor(role: string) {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      cashier: 'bg-green-100 text-green-700',
      staff: 'bg-slate-100 text-slate-600',
    }
    return colors[role] ?? 'bg-slate-100 text-slate-600'
  }

  function getInitials(name: string) {
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (!selected) {
    return (
      <div className="space-y-5">
        <p className="text-center text-slate-500 text-sm">Select your name to continue</p>
        <div className="grid grid-cols-2 gap-3">
          {profiles.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#111827] hover:shadow-md transition-all duration-150 active:scale-[0.97]"
            >
              <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white font-bold text-lg">
                {getInitials(p.name)}
              </div>
              <p className="font-semibold text-[#111827] text-sm text-center leading-tight">{p.name}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRoleColor(p.role)}`}>
                {getRoleLabel(p.role)}
              </span>
            </button>
          ))}
        </div>
        {profiles.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-4">No staff accounts found. Use admin login.</p>
        )}
        <button
          type="button"
          onClick={onAdminLogin}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-2"
        >
          Admin email login →
        </button>
      </div>
    )
  }

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setSelected(null); setPin(''); setError('') }}
          className="text-slate-400 hover:text-slate-700 transition-colors text-sm flex items-center gap-1">
          ← Back
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {getInitials(selected.name)}
          </div>
          <div>
            <p className="font-semibold text-[#111827] text-sm leading-tight">{selected.name}</p>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${getRoleColor(selected.role)}`}>
              {getRoleLabel(selected.role)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-slate-500">Enter 4-digit PIN</p>

      <div className="flex justify-center gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${
            i < pin.length
              ? error ? 'bg-red-400' : 'bg-[#111827] scale-110'
              : 'bg-slate-200'
          }`} />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm text-red-500 font-medium">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {numpad.flat().map((key, i) => {
          if (!key) return <div key={i} />
          if (key === '⌫') {
            return (
              <button key={i} type="button" onClick={handleBackspace}
                disabled={loading}
                className="h-14 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-lg hover:bg-slate-50 active:scale-[0.95] transition-all disabled:opacity-40">
                ⌫
              </button>
            )
          }
          return (
            <button key={i} type="button" onClick={() => handleDigit(key)}
              disabled={loading || pin.length >= 4}
              className="h-14 rounded-xl border border-slate-200 bg-white text-[#111827] font-bold text-xl hover:bg-slate-50 hover:border-[#111827]/30 active:scale-[0.95] transition-all disabled:opacity-40">
              {key}
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="text-center text-xs text-slate-400">Signing in…</p>
      )}

      <div className="text-center">
        <Link href="/forgot-pin" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Forgot PIN?
        </Link>
      </div>
    </div>
  )
}
