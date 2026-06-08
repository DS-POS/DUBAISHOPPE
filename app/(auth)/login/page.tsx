import { createClient } from '@/lib/supabase/server'
import { PinLoginWrapper } from './PinLoginWrapper'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const activeProfiles = (profiles ?? []) as { id: string; name: string; role: string }[]

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-lg" style={{ clipPath: 'inset(0 0 26% 0)' }}>
            <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="w-20 h-20 object-contain object-top" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Rubik, sans-serif' }}>DS POS</h1>
          <p className="text-slate-400 mt-1 text-sm">Dubai Shoppe — Camera Store</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <PinLoginWrapper profiles={activeProfiles} />
        </div>
      </div>
    </div>
  )
}
