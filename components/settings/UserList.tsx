'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateUserRole, setUserActive, resetStaffPin } from '@/actions/users'
import type { Profile, UserRole } from '@/types/database'
import { ShieldIcon, UserIcon, CheckCircle2Icon, XCircleIcon, KeyRoundIcon } from 'lucide-react'

interface Props {
  profiles: Profile[]
  currentUserId: string
}

function ResetPinModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await resetStaffPin(user.id, pin)
        toast.success(`PIN reset for ${user.name}`)
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reset PIN')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-lg text-slate-900">Reset PIN — {user.name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New PIN (4 digits)</label>
            <input
              type="text" inputMode="numeric" maxLength={4} required
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              autoFocus
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={isPending || pin.length !== 4}
              className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {isPending ? 'Saving…' : 'Reset PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function UserList({ profiles, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)

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
    <>
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const isSelf = profile.id === currentUserId
              return (
                <tr key={profile.id}
                  className="border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        {profile.role === 'admin'
                          ? <ShieldIcon className="size-4 text-slate-600" />
                          : <UserIcon className="size-4 text-slate-400" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{profile.name || profile.email || 'Unknown'}</p>
                        {profile.email && <p className="text-xs text-slate-400">{profile.email}</p>}
                        {isSelf && <span className="text-xs text-blue-500 font-medium">You</span>}
                        {!profile.pin_hash && (
                          <span className="text-xs text-amber-500 font-medium ml-1">No PIN</span>
                        )}
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
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
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
                    <div className="flex items-center justify-end gap-2">
                      {!isSelf && (
                        <button type="button" disabled={isPending}
                          onClick={() => setResetTarget(profile)}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                          <KeyRoundIcon className="size-3" /> PIN
                        </button>
                      )}
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
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <ResetPinModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </>
  )
}
