import Link from 'next/link'
import { TruckIcon } from 'lucide-react'
import { getSuppliers } from '@/actions/suppliers'

export async function SuppliersQuickWidget() {
  const suppliers = await getSuppliers()
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <TruckIcon className="size-5 text-slate-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Suppliers</p>
          <p className="text-xs text-slate-500">{suppliers.length} total</p>
        </div>
      </div>
      <Link href="/suppliers" className="text-xs font-semibold text-blue-600 hover:underline">View All →</Link>
    </div>
  )
}
