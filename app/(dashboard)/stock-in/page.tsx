import Link from 'next/link'
import { getSupplierInvoices } from '@/actions/supplier-invoices'
import { Button } from '@/components/ui/button'
import SupplierInvoiceList from '@/components/stock-in/SupplierInvoiceList'
import { createClient } from '@/lib/supabase/server'

export default async function StockInPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const userRole = (profile?.role as string) ?? 'staff'

  const invoices = await getSupplierInvoices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Supplier Invoices
          </h1>
          <p className="text-slate-500 text-sm mt-1">All supplier invoices and stock received</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-in/new">
            <Button variant="outline" size="sm">+ Manual Entry</Button>
          </Link>
          <Link href="/stock-in/import">
            <Button size="sm">↑ Import Invoice</Button>
          </Link>
        </div>
      </div>

      {/* Supplier Invoices */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Supplier Invoices</h2>
        <SupplierInvoiceList initialInvoices={invoices} userRole={userRole} />
      </div>
    </div>
  )
}
