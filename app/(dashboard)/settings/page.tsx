import { getSettings } from '@/actions/settings'
import SettingsForm from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const settings = await getSettings()
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
      <SettingsForm initialSettings={settings} />
    </div>
  )
}
