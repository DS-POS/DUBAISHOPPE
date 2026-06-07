'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase sets the session from the URL hash on PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated successfully')
      router.push('/dashboard')
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
          <h2 className="text-xl font-semibold text-[#111827] mb-6" style={{ fontFamily: 'Rubik,sans-serif' }}>New Password</h2>

          {!ready ? (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Verifying reset link…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 text-white font-semibold py-2.5">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
