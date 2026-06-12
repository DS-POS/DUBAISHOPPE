import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TroubleshootPanel from '@/components/troubleshoot/TroubleshootPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Troubleshoot — DS POS' }

export default async function TroubleshootPage() {
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.getUser()
  if (error || !authData.user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', authData.user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-2xl mx-auto py-2">
      <TroubleshootPanel />
    </div>
  )
}
