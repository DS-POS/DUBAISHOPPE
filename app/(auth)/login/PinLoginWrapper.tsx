'use client'

import { useState } from 'react'
import { PinLogin } from './PinLogin'
import LoginForm from './LoginForm'

interface StaffProfile {
  id: string
  name: string
  role: string
}

interface Props {
  profiles: StaffProfile[]
}

export function PinLoginWrapper({ profiles }: Props) {
  const [mode, setMode] = useState<'pin' | 'admin'>('pin')

  if (mode === 'admin') {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setMode('pin')}
          className="text-slate-400 hover:text-slate-700 text-sm transition-colors flex items-center gap-1">
          ← Back to PIN login
        </button>
        <h2 className="text-lg font-semibold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>Admin Sign In</h2>
        <LoginForm />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#111827] mb-4 text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
        Who&apos;s working today?
      </h2>
      <PinLogin profiles={profiles} onAdminLogin={() => setMode('admin')} />
    </div>
  )
}
