'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowLeftIcon } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
            <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Rubik,sans-serif' }}>DS POS</h1>
          <p className="text-slate-400 mt-1 text-sm">Dubai Shoppe — Camera Store</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/login" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ArrowLeftIcon className="size-4 text-slate-600" />
            </Link>
            <h2 className="text-xl font-semibold text-[#111827]" style={{ fontFamily: 'Rubik,sans-serif' }}>Reset Password</h2>
          </div>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-slate-900 mb-1">Check your email</p>
              <p className="text-sm text-slate-500">Password reset link sent to <span className="font-medium text-slate-700">{email}</span></p>
              <Link href="/login" className="mt-5 inline-block text-sm font-medium text-[#111827] hover:underline">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-500 -mt-2 mb-2">Enter your email and we&apos;ll send a reset link.</p>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@dubaishoppe.com"
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 text-white font-semibold py-2.5">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Send Reset Link'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
