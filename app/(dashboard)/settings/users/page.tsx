import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { getProfiles } from '@/actions/users'
import { UserList } from '@/components/settings/UserList'
import { AddStaffButton } from '@/components/settings/AddStaffButton'

export default async function UsersPage() {
  const role = await getUserRole()
  if (role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">{profiles.length} user{profiles.length !== 1 ? 's' : ''} registered</p>
        </div>
        <AddStaffButton />
      </div>
      <UserList profiles={profiles} currentUserId={user.id} />
    </div>
  )
}
