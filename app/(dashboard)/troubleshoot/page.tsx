import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/get-user-role'
import TroubleshootPanel from '@/components/troubleshoot/TroubleshootPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Troubleshoot — DS POS' }

export default async function TroubleshootPage() {
  const userRole = await getUserRole()
  if (!userRole) redirect('/login')
  if (userRole !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-2xl mx-auto py-2">
      <TroubleshootPanel />
    </div>
  )
}
