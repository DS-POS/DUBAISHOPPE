import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) redirect('/login')
  const user = authData.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar userRole={profile?.role || 'staff'} />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-56 min-w-0">
        <TopBar user={profile} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 xl:p-5 pb-20 md:pb-5">
          <div className="w-full max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
