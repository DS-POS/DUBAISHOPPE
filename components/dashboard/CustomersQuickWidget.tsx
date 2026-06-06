import Link from 'next/link'
import { UsersIcon } from 'lucide-react'
import { getCustomers } from '@/actions/customers'

export async function CustomersQuickWidget() {
  const customers = await getCustomers()
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <UsersIcon className="size-5 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Customers</p>
          <p className="text-xs text-slate-500">{customers.length} total</p>
        </div>
      </div>
      <Link href="/customers" className="text-xs font-semibold text-blue-600 hover:underline">View All →</Link>
    </div>
  )
}
