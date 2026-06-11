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
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (pin.length === 4 && selected && !loading) {
      submitPin()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // Keyboard input when PIN screen is active
  useEffect(() => {
    if (!selected) return
    function handleKeyDown(e: KeyboardEvent) {
      if (loading) return
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          setError('')
          setPin(p => p + e.key)
        }
      } else if (e.key === 'Backspace') {
        setError('')
        setPin(p => p.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, loading, pin])

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
        setShake(true)
        setTimeout(() => setShake(false), 600)
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

  function getRoleBadgeStyle(role: string) {
    const styles: Record<string, string> = {
      admin: 'bg-violet-100 text-violet-700 border border-violet-200',
      manager: 'bg-blue-100 text-blue-700 border border-blue-200',
      cashier: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      staff: 'bg-slate-100 text-slate-600 border border-slate-200',
    }
    return styles[role] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
  }

  function getAvatarStyle(role: string) {
    const styles: Record<string, string> = {
      admin: 'from-violet-600 to-violet-800',
      manager: 'from-blue-600 to-blue-800',
      cashier: 'from-emerald-500 to-emerald-700',
      staff: 'from-slate-600 to-slate-800',
    }
    return styles[role] ?? 'from-slate-600 to-slate-800'
  }

  function getInitials(name: string) {
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Staff selection screen
  if (!selected) {
    return (
      <div className="space-y-5">
        {profiles.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-slate-500 text-sm font-medium">No staff accounts found</p>
            <p className="text-slate-400 text-xs">Ask your admin to create staff accounts</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${profiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {profiles.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-md transition-all duration-200 active:scale-[0.97]"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarStyle(p.role)} flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-105 transition-transform duration-200`}>
                  {getInitials(p.name)}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{p.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-1.5 ${getRoleBadgeStyle(p.role)}`}>
                    {getRoleLabel(p.role)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={onAdminLogin}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-2.5 font-medium"
          >
            Admin email login →
          </button>
        </div>
      </div>
    )
  }

  // PIN entry screen
  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div className="space-y-6">
      {/* Selected user header */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
        <button
          type="button"
          onClick={() => { setSelected(null); setPin(''); setError('') }}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          title="Back"
        >
          ←
        </button>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarStyle(selected.role)} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
          {getInitials(selected.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{selected.name}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${getRoleBadgeStyle(selected.role)}`}>
            {getRoleLabel(selected.role)}
          </span>
        </div>
      </div>

      {/* PIN dots */}
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-500 font-medium">Enter your 4-digit PIN</p>
        <div className={`flex justify-center gap-4 ${shake ? 'animate-shake' : ''}`}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                i < pin.length
                  ? error
                    ? 'bg-red-500 scale-110'
                    : 'bg-slate-900 scale-125'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2.5">
        {numpad.flat().map((key, i) => {
          if (!key) return <div key={i} />
          if (key === '⌫') {
            return (
              <button
                key={i}
                type="button"
                onClick={handleBackspace}
                disabled={loading}
                className="h-14 rounded-2xl border border-slate-200 bg-white text-slate-500 font-bold text-lg hover:bg-slate-50 hover:border-slate-300 active:scale-[0.94] transition-all duration-100 disabled:opacity-40 shadow-sm"
              >
                ⌫
              </button>
            )
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDigit(key)}
              disabled={loading || pin.length >= 4}
              className="h-14 rounded-2xl border border-slate-200 bg-white text-slate-900 font-bold text-xl hover:bg-slate-50 hover:border-slate-300 active:scale-[0.94] transition-all duration-100 disabled:opacity-40 shadow-sm"
            >
              {loading && pin.length === 4 && key === pin[3] ? (
                <span className="flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                </span>
              ) : key}
            </button>
          )
        })}
      </div>

      {/* Footer links */}
      <div className="flex items-center justify-between pt-1">
        <Link href="/forgot-pin" className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium">
          Forgot PIN?
        </Link>
        <button
          type="button"
          onClick={onAdminLogin}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
        >
          Admin login →
        </button>
      </div>
    </div>
  )
}
