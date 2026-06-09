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
      <div className="p-7 space-y-5">
        <button
          type="button"
          onClick={() => setMode('pin')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium"
        >
          <span className="text-base">←</span> Back to staff login
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Rubik, sans-serif' }}>Admin Sign In</h2>
          <p className="text-sm text-slate-500 mt-0.5">Enter your email and password</p>
        </div>
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="p-7">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Who&apos;s working today?
        </h2>
        <p className="text-sm text-slate-400 text-center mt-1">Select your name to continue</p>
      </div>
      <PinLogin profiles={profiles} onAdminLogin={() => setMode('admin')} />
    </div>
  )
}
