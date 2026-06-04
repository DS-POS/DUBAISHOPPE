import Link from 'next/link'
import { getSettings } from '@/actions/settings'
import { getUserRole } from '@/lib/get-user-role'
import SettingsForm from '@/components/settings/SettingsForm'
import { UsersIcon, ChevronRightIcon } from 'lucide-react'

export default async function SettingsPage() {
  const [settings, role] = await Promise.all([getSettings(), getUserRole()])

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-2xl font-bold text-[#111827]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage bank details, terms &amp; conditions, and signature for quotations
        </p>
      </div>

      {role === 'admin' && (
        <Link href="/settings/users"
          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <UsersIcon className="size-5 text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">User Management</p>
              <p className="text-sm text-slate-500">Manage staff accounts and roles</p>
            </div>
          </div>
          <ChevronRightIcon className="size-5 text-slate-400" />
        </Link>
      )}

      <SettingsForm initialSettings={settings} />
    </div>
  )
}
