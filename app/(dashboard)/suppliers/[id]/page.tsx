import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSupplierById } from '@/actions/suppliers'
import { getSupplierInvoicesByName } from '@/actions/supplier-invoices'
import {
  ArrowLeftIcon,
  PencilIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  BuildingIcon,
  PackageIcon,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  partial: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  pending: 'bg-red-50 text-red-600 ring-1 ring-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  pending: 'Due',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params
  const supplier = await getSupplierById(id)
  if (!supplier) notFound()

  const invoices = await getSupplierInvoicesByName(supplier.name)

  const totalSpent = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)
  const totalPaid = invoices.reduce((sum, inv) => {
    const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    return sum + paid
  }, 0)
  const totalDue = totalSpent - totalPaid

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/suppliers"
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="size-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{supplier.name}</h1>
            {supplier.business_name && (
              <p className="text-sm text-slate-500 mt-0.5">{supplier.business_name}</p>
            )}
          </div>
        </div>
        <Link href={`/suppliers/${id}/edit`}>
          <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm transition-all cursor-pointer">
            <PencilIcon className="size-3.5" />
            Edit Supplier
          </span>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#F3F4F6] rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{invoices.length}</p>
        </div>
        <div className="bg-[#E5E7EB] rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Due</p>
          <p className={`text-2xl font-black mt-1 ${totalDue > 0 ? 'text-red-600' : 'text-[#4B5563]'}`}>
            ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Supplier Info Card */}
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Contact Details</h2>

          {supplier.phone && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                <PhoneIcon className="size-3.5 text-[#4B5563]" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone</p>
                <p className="text-sm font-semibold text-slate-800">{supplier.phone}</p>
              </div>
            </div>
          )}

          {supplier.email && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                <MailIcon className="size-3.5 text-[#4B5563]" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-semibold text-slate-800 break-all">{supplier.email}</p>
              </div>
            </div>
          )}

          {supplier.gstin && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                <BuildingIcon className="size-3.5 text-[#4B5563]" />
              </div>
              <div>
                <p className="text-xs text-slate-400">GSTIN</p>
                <p className="text-sm font-mono font-semibold text-slate-800">{supplier.gstin}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <MapPinIcon className="size-3.5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400">State</p>
              <p className="text-sm font-semibold text-slate-800">{supplier.state}</p>
            </div>
          </div>

          {supplier.address && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                <MapPinIcon className="size-3.5 text-[#4B5563]" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Address</p>
                <p className="text-sm text-slate-700 leading-relaxed">{supplier.address}</p>
              </div>
            </div>
          )}

          {supplier.notes && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-1">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed">{supplier.notes}</p>
            </div>
          )}

          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            Added {format(parseISO(supplier.created_at), 'dd MMM yyyy')}
          </p>
        </div>

        {/* Purchase Invoices */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Purchase Invoices</h2>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                {invoices.length}
              </span>
            </div>

            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <PackageIcon className="size-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No invoices yet</p>
                <p className="text-xs text-slate-400 mt-1">Purchase invoices from this supplier will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111827] border-b border-[#1F2937]">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice No</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(inv => {
                      const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                      const due = Number(inv.total_amount) - paid
                      return (
                        <tr key={inv.id} className="hover:bg-[#D1D5DB]/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs font-semibold text-[#111827]">
                              {inv.purchase_invoice_no ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs">
                            {format(parseISO(inv.purchase_date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <p className="font-semibold text-slate-900">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            {due > 0 && (
                              <p className="text-xs text-red-500 mt-0.5">Due ₹{due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.payment_status] ?? STATUS_COLORS.pending}`}>
                              {STATUS_LABELS[inv.payment_status] ?? inv.payment_status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/stock-in/${inv.id}`}
                              className="text-xs font-semibold text-[#111827] hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
