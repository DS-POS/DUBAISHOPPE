'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateUserRole, setUserActive } from '@/actions/users'
import type { Profile, UserRole } from '@/types/database'
import { ShieldIcon, UserIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'

interface Props {
  profiles: Profile[]
  currentUserId: string
}

export function UserList({ profiles, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, role: UserRole) {
    startTransition(async () => {
      try {
        await updateUserRole(userId, role)
        toast.success('Role updated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update role')
      }
    })
  }

  function handleActiveToggle(userId: string, isActive: boolean) {
    if (!confirm(`${isActive ? 'Activate' : 'Deactivate'} this user?`)) return
    startTransition(async () => {
      try {
        await setUserActive(userId, isActive)
        toast.success(isActive ? 'User activated' : 'User deactivated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update user')
      }
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#111827]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">User</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Role</th>
            <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile, i) => {
            const isSelf = profile.id === currentUserId
            return (
              <tr key={profile.id}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      {profile.role === 'admin'
                        ? <ShieldIcon className="size-4 text-slate-600" />
                        : <UserIcon className="size-4 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#111827]">{profile.name || profile.email || 'Unknown'}</p>
                      {profile.email && <p className="text-xs text-slate-400">{profile.email}</p>}
                      {isSelf && <span className="text-xs text-blue-500 font-medium">You</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={profile.role}
                    disabled={isPending || isSelf}
                    onChange={e => handleRoleChange(profile.id, e.target.value as UserRole)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  {profile.is_active
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <CheckCircle2Icon className="size-3" /> Active
                      </span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        <XCircleIcon className="size-3" /> Inactive
                      </span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  {!isSelf && (
                    <button type="button" disabled={isPending}
                      onClick={() => handleActiveToggle(profile.id, !profile.is_active)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                        profile.is_active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}>
                      {profile.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
