import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { getProfiles } from '@/actions/users'
import { UserList } from '@/components/settings/UserList'
import { InfoIcon } from 'lucide-react'

export default async function UsersPage() {
  const role = await getUserRole()
  if (role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          User Management
        </h1>
        <p className="text-slate-500 text-sm mt-1">{profiles.length} user{profiles.length !== 1 ? 's' : ''} registered</p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
        <InfoIcon className="size-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-0.5">Inviting new staff</p>
          <p>Go to <strong>Supabase Dashboard → Authentication → Users → Invite user</strong>. New users automatically get the <em>Staff</em> role. Change their role here after they sign in.</p>
        </div>
      </div>

      <UserList profiles={profiles} currentUserId={user.id} />
    </div>
  )
}
