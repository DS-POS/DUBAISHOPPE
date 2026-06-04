import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Truck,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { getInvoiceStats, getRecentDueInvoices, getRecentInvoices } from '@/actions/invoices'
import { getSupplierDueStats, getRecentDueSupplierInvoices } from '@/actions/supplier-invoices'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  pending: 'Due',
  cancelled: 'Cancelled',
}

export default async function DashboardPage() {
  const [stats, dueInvoices, recentInvoices, supplierDueStats, dueSupplierInvoices] = await Promise.all([
    getInvoiceStats(),
    getRecentDueInvoices(),
    getRecentInvoices(),
    getSupplierDueStats(),
    getRecentDueSupplierInvoices(),
  ])

  return (
    <div className="space-y-6 pb-12">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back — here&apos;s your business overview</p>
        </div>
        <Link href="/billing">
          <button className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150">
            <ShoppingCart className="size-4" />
            New Sale
          </button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* Today's Sales */}
        <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-[#111827] text-white rounded-xl p-2 mb-3">
            <ShoppingCart className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Today&apos;s Sales
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            ₹{formatINR(stats.todayRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.todayCount} {stats.todayCount === 1 ? 'invoice' : 'invoices'} today
          </p>
          <Link href="/invoices" className="text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-3 inline-block transition-colors">
            View invoices →
          </Link>
        </div>

        {/* Total Revenue — hero dark card */}
        <div className="bg-[#111827] rounded-2xl p-6 ring-1 ring-[#1F2937] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-xl p-2 mb-3">
            <TrendingUp className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-white mt-2">
            ₹{formatINR(stats.totalRevenue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            ₹{formatINR(stats.totalPaid)} collected
          </p>
          <Link href="/invoices" className="text-xs font-medium text-slate-400 hover:text-white hover:underline mt-3 inline-block transition-colors">
            View all →
          </Link>
        </div>

        {/* Due from Customers */}
        <div className="bg-rose-50 rounded-2xl p-6 ring-1 ring-rose-100 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-rose-600 text-white rounded-xl p-2 mb-3">
            <AlertCircle className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Due from Customers
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            ₹{formatINR(stats.totalDue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.dueCount} {stats.dueCount === 1 ? 'invoice' : 'invoices'} pending
          </p>
          <Link href="/invoices?status=pending" className="text-xs font-medium text-rose-600 hover:underline mt-3 inline-block transition-colors">
            Collect dues →
          </Link>
        </div>

        {/* Due to Suppliers — secondary dark card */}
        <div className="bg-[#1F2937] rounded-2xl p-6 ring-1 ring-[#374151] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-xl p-2 mb-3">
            <Truck className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Due to Suppliers
          </p>
          <p className="text-2xl font-bold text-white mt-2">
            ₹{formatINR(supplierDueStats.totalDue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {supplierDueStats.dueCount} {supplierDueStats.dueCount === 1 ? 'invoice' : 'invoices'} unpaid
          </p>
          <Link href="/stock-in" className="text-xs font-medium text-slate-400 hover:text-white hover:underline mt-3 inline-block transition-colors">
            Pay suppliers →
          </Link>
        </div>

        {/* Total Invoices */}
        <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-[#F3F4F6] text-[#4B5563] rounded-xl p-2 mb-3">
            <FileText className="size-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Invoices
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.totalInvoices}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            All time
          </p>
          <Link href="/invoices" className="text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-3 inline-block transition-colors">
            View all →
          </Link>
        </div>

      </div>

      {/* Outstanding Customer Dues */}
      {dueInvoices.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                {stats.dueCount}
              </span>
              <h2 className="font-semibold text-slate-900">Outstanding Customer Dues</h2>
            </div>
            <Link href="/invoices?status=pending" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">
              View all
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Paid</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-red-400 uppercase tracking-wide">Due</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dueInvoices.map((inv) => {
                  const due = Number(inv.grand_total) - Number(inv.amount_paid)
                  return (
                    <tr key={inv.id} className="row-hover">
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">
                        {inv.invoice_no}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 text-sm">
                          {inv.customers?.name ?? 'Walk-in'}
                        </p>
                        {inv.customers?.phone && (
                          <p className="text-xs text-slate-400">{inv.customers.phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                        {format(parseISO(inv.created_at), 'd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700">
                        ₹{formatINR(Number(inv.grand_total))}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-emerald-600 hidden md:table-cell">
                        ₹{formatINR(Number(inv.amount_paid))}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="bg-red-50 text-red-700 font-bold text-sm px-2 py-0.5 rounded-full">
                          ₹{formatINR(due)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/invoices/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Supplier Payments */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-xs font-bold">
              {supplierDueStats.dueCount}
            </span>
            <h2 className="font-semibold text-slate-900">Pending Supplier Payments</h2>
          </div>
          <Link href="/stock-in" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">
            View all
          </Link>
        </div>

        {dueSupplierInvoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-700 font-semibold text-sm">All cleared!</p>
            <p className="text-slate-500 text-xs mt-1">No pending supplier payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dueSupplierInvoices.map((inv) => (
                  <tr key={inv.id} className="row-hover">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">
                      {inv.purchase_invoice_no ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 text-sm">
                      {inv.supplier_name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                      {format(parseISO(inv.purchase_date), 'd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-slate-900 font-bold text-sm">
                        ₹{formatINR(Number(inv.total_amount))}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        inv.payment_status === 'partial'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/stock-in/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">
                        Pay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Invoices</h2>
          <Link href="/invoices" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">
            View all
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText className="size-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">No invoices yet.</p>
            <Link href="/billing" className="text-xs font-medium text-[#4B5563] hover:underline mt-2 inline-block">
              Create your first invoice →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="row-hover">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">
                      {inv.invoice_no}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 text-sm">
                      {inv.customers?.name ?? 'Walk-in'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                      {format(parseISO(inv.created_at), 'd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">
                      ₹{formatINR(Number(inv.grand_total))}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-500'
                      }`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/invoices/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
