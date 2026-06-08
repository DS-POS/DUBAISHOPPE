import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetPinForm } from '@/components/auth/SetPinForm'

export const dynamic = 'force-dynamic'

export default async function SetPinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Rubik, sans-serif' }}>Set New PIN</h1>
          <p className="text-slate-400 mt-1 text-sm">Choose a new 4-digit PIN</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <SetPinForm />
        </div>
      </div>
    </div>
  )
}
