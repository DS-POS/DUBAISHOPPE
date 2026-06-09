import { createAdminClient } from '@/lib/supabase/admin'
import { PinLoginWrapper } from './PinLoginWrapper'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .neq('is_active', false)
    .order('name', { ascending: true })

  const activeProfiles = (profiles ?? []) as { id: string; name: string; role: string }[]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>

      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="w-28 h-28 bg-white rounded-3xl shadow-2xl flex items-center justify-center overflow-hidden"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.4)' }}>
              <img
                src="/DUBAI LOGO BR.png"
                alt="Dubai Shoppe"
                className="w-24 h-24 object-contain"
                style={{ clipPath: 'inset(0 0 24% 0)' }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>
            DS POS
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm font-medium tracking-wide">Dubai Shoppe — Camera Store</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 32px 64px rgba(0,0,0,0.5)',
          }}>
          <PinLoginWrapper profiles={activeProfiles} />
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          © 2024 Dubai Shoppe. All rights reserved.
        </p>
      </div>
    </div>
  )
}
