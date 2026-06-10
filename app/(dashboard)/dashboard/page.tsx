import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Truck,
  FileText,
  CheckCircle2,
  CalendarIcon,
  ClockIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInvoiceStats, getRecentDueInvoices, getDashboardRevenueChart } from '@/actions/invoices'
import { getSupplierDueStats, getRecentDueSupplierInvoices } from '@/actions/supplier-invoices'
import { getStoreLoanStats } from '@/actions/store-loans'
import { LowStockWidget } from '@/components/dashboard/LowStockWidget'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ExpensesWidget } from '@/components/dashboard/ExpensesWidget'
import { StoreLoansWidget } from '@/components/dashboard/StoreLoansWidget'
import { DashboardWidgets } from '@/components/dashboard/DashboardWidgets'
import { LabelsQuickWidget } from '@/components/dashboard/LabelsQuickWidget'
import { CustomersQuickWidget } from '@/components/dashboard/CustomersQuickWidget'
import { SuppliersQuickWidget } from '@/components/dashboard/SuppliersQuickWidget'

function formatINR(amount: number) {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const isManager = profile?.role === 'manager'

  const [stats, dueInvoices, supplierDueStats, dueSupplierInvoices, chartData, loanStats] = await Promise.all([
    getInvoiceStats(),
    getRecentDueInvoices(),
    isManager ? Promise.resolve({ totalDue: 0, dueCount: 0 }) : getSupplierDueStats(),
    isManager ? Promise.resolve([]) : getRecentDueSupplierInvoices(),
    isManager ? Promise.resolve([]) : getDashboardRevenueChart(30),
    getStoreLoanStats(),
  ])

  const statCards = (
    <div className={`grid gap-2 md:gap-4 ${isManager ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-5'}`}>
      {!isManager && (
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-6 ring-1 ring-slate-200 shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-[#111827] text-white rounded-lg md:rounded-xl p-1.5 md:p-2 mb-2 md:mb-3">
            <ShoppingCart className="size-3.5 md:size-4" />
          </div>
          <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Today&apos;s Sales</p>
          <p className="text-base md:text-2xl font-bold text-slate-900 mt-1 md:mt-2 truncate">₹{formatINR(stats.todayRevenue)}</p>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1">{stats.todayCount} {stats.todayCount === 1 ? 'invoice' : 'invoices'}</p>
          <Link href="/invoices" className="text-[10px] md:text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-2 md:mt-3 inline-block transition-colors">View →</Link>
        </div>
      )}

      {!isManager && (
        <div className="bg-[#111827] rounded-xl md:rounded-2xl p-3 md:p-6 ring-1 ring-[#1F2937] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-lg md:rounded-xl p-1.5 md:p-2 mb-2 md:mb-3">
            <TrendingUp className="size-3.5 md:size-4" />
          </div>
          <p className="text-[10px] md:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-base md:text-2xl font-bold text-white mt-1 md:mt-2 truncate">₹{formatINR(stats.totalRevenue)}</p>
          <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 md:mt-1 truncate">₹{formatINR(stats.totalPaid)} paid</p>
          <Link href="/invoices" className="text-[10px] md:text-xs font-medium text-slate-400 hover:text-white hover:underline mt-2 md:mt-3 inline-block transition-colors">View →</Link>
        </div>
      )}

      <div className="bg-rose-50 rounded-xl md:rounded-2xl p-3 md:p-6 ring-1 ring-rose-100 shadow-sm card-hover">
        <div className="inline-flex items-center justify-center bg-rose-600 text-white rounded-lg md:rounded-xl p-1.5 md:p-2 mb-2 md:mb-3">
          <AlertCircle className="size-3.5 md:size-4" />
        </div>
        <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Customer Dues</p>
        <p className="text-base md:text-2xl font-bold text-slate-900 mt-1 md:mt-2 truncate">₹{formatINR(stats.totalDue)}</p>
        <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1">{stats.dueCount} pending</p>
        <Link href="/invoices?status=pending" className="text-[10px] md:text-xs font-medium text-rose-600 hover:underline mt-2 md:mt-3 inline-block transition-colors">Collect →</Link>
      </div>

      {!isManager && (
        <div className="bg-[#1F2937] rounded-xl md:rounded-2xl p-3 md:p-6 ring-1 ring-[#374151] shadow-sm card-hover">
          <div className="inline-flex items-center justify-center bg-white/10 text-white rounded-lg md:rounded-xl p-1.5 md:p-2 mb-2 md:mb-3">
            <Truck className="size-3.5 md:size-4" />
          </div>
          <p className="text-[10px] md:text-xs font-medium text-slate-400 uppercase tracking-wider">Supplier Dues</p>
          <p className="text-base md:text-2xl font-bold text-white mt-1 md:mt-2 truncate">₹{formatINR(supplierDueStats.totalDue)}</p>
          <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 md:mt-1">{supplierDueStats.dueCount} unpaid</p>
          <Link href="/stock-in" className="text-[10px] md:text-xs font-medium text-slate-400 hover:text-white hover:underline mt-2 md:mt-3 inline-block transition-colors">Pay →</Link>
        </div>
      )}

      <div className={`bg-white rounded-xl md:rounded-2xl p-3 md:p-6 ring-1 ring-slate-200 shadow-sm card-hover ${isManager ? '' : 'col-span-2 lg:col-span-1'}`}>
        <div className="inline-flex items-center justify-center bg-[#F3F4F6] text-[#4B5563] rounded-lg md:rounded-xl p-1.5 md:p-2 mb-2 md:mb-3">
          <FileText className="size-3.5 md:size-4" />
        </div>
        <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoices</p>
        <p className="text-base md:text-2xl font-bold text-slate-900 mt-1 md:mt-2">{stats.totalInvoices}</p>
        <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1">All time</p>
        <Link href="/invoices" className="text-[10px] md:text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline mt-2 md:mt-3 inline-block transition-colors">View all →</Link>
      </div>
    </div>
  )

  const invoiceQuick = (
    <div className="grid grid-cols-2 gap-2 md:gap-4">
      <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 ring-1 ring-slate-200 shadow-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="size-4 md:size-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">Today&apos;s</p>
            <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">{stats.todayCount} · ₹{formatINR(stats.todayRevenue)}</p>
          </div>
        </div>
        <Link href="/invoices" className="flex-shrink-0 text-[10px] md:text-xs font-semibold text-[#111827] bg-slate-100 hover:bg-slate-200 px-2 md:px-3 py-1 md:py-1.5 rounded-lg transition-colors">View</Link>
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 ring-1 ring-rose-100 shadow-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
            <ClockIcon className="size-4 md:size-5 text-rose-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">Pending</p>
            <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">{stats.dueCount} · ₹{formatINR(stats.totalDue)}</p>
          </div>
        </div>
        <Link href="/invoices?status=pending" className="flex-shrink-0 text-[10px] md:text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 md:px-3 py-1 md:py-1.5 rounded-lg transition-colors">View</Link>
      </div>
    </div>
  )

  const customerDues = dueInvoices.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">{stats.dueCount}</span>
          <h2 className="font-semibold text-slate-900">Outstanding Customer Dues</h2>
        </div>
        <Link href="/invoices?status=pending" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">View all</Link>
      </div>
      {/* Mobile: compact cards */}
      <div className="block md:hidden divide-y divide-slate-100">
        {dueInvoices.map((inv) => {
          const due = Number(inv.grand_total) - Number(inv.amount_paid)
          return (
            <div key={inv.id} className="px-4 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-slate-900">{inv.invoice_no}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{inv.customers?.name ?? 'Walk-in'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.created_at), 'd MMM yyyy')}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="bg-red-50 text-red-700 font-bold text-sm px-2 py-0.5 rounded-full tabular-nums">₹{formatINR(due)}</span>
                <Link href={`/invoices/${inv.id}`} className="text-xs font-semibold text-[#111827] underline">View</Link>
              </div>
            </div>
          )
        })}
      </div>
      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#111827] border-b border-[#111827]">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Date</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Paid</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-red-400 uppercase tracking-wide">Due</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dueInvoices.map((inv) => {
              const due = Number(inv.grand_total) - Number(inv.amount_paid)
              return (
                <tr key={inv.id} className="row-hover">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{inv.invoice_no}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900 text-sm">{inv.customers?.name ?? 'Walk-in'}</p>
                    {inv.customers?.phone && <p className="text-xs text-slate-400">{inv.customers.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{format(parseISO(inv.created_at), 'd MMM yyyy')}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-slate-700">₹{formatINR(Number(inv.grand_total))}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-emerald-600">₹{formatINR(Number(inv.amount_paid))}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="bg-red-50 text-red-700 font-bold text-sm px-2 py-0.5 rounded-full">₹{formatINR(due)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/invoices/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">View</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  ) : null

  const supplierPayments = (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden card-hover">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-xs font-bold">{supplierDueStats.dueCount}</span>
          <h2 className="font-semibold text-slate-900">Pending Supplier Payments</h2>
        </div>
        <Link href="/stock-in" className="text-xs text-[#4B5563] font-medium hover:text-[#111827] hover:underline transition-colors">View all</Link>
      </div>
      {dueSupplierInvoices.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-emerald-700 font-semibold text-sm">All cleared!</p>
          <p className="text-slate-500 text-xs mt-1">No pending supplier payments.</p>
        </div>
      ) : (
        <>
          {/* Mobile: compact cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {dueSupplierInvoices.map((inv) => (
              <div key={inv.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold text-slate-900 truncate">{inv.purchase_invoice_no ?? '—'}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{inv.supplier_name ?? '—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.purchase_date), 'd MMM yyyy')}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="font-bold text-sm text-slate-900 tabular-nums">₹{formatINR(Number(inv.total_amount))}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${inv.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{inv.payment_status}</span>
                  <Link href={`/stock-in/${inv.id}`} className="text-xs font-semibold text-[#111827] underline">Pay</Link>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-[#111827]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dueSupplierInvoices.map((inv) => (
                  <tr key={inv.id} className="row-hover">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{inv.purchase_invoice_no ?? '—'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 text-sm">{inv.supplier_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{format(parseISO(inv.purchase_date), 'd MMM yyyy')}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-slate-900 font-bold text-sm">₹{formatINR(Number(inv.total_amount))}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${inv.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/stock-in/${inv.id}`} className="text-xs text-[#4B5563] hover:text-[#111827] hover:underline font-medium transition-colors">Pay</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 hidden sm:block">Welcome back — here&apos;s your business overview</p>
        </div>
        <Link href="/billing">
          <button className="inline-flex items-center gap-1.5 md:gap-2 bg-[#111827] hover:bg-[#1F2937] active:scale-95 text-white text-xs md:text-sm font-semibold px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-sm transition-all duration-150">
            <ShoppingCart className="size-3.5 md:size-4" />
            New Sale
          </button>
        </Link>
      </div>

      <DashboardWidgets
        statCards={statCards}
        invoiceQuick={invoiceQuick}
        storeLoans={<StoreLoansWidget stats={loanStats} />}
        revenueChart={isManager ? null : (
          <RevenueChart
            data={chartData}
            totalRevenue={chartData.reduce((s, d) => s + d.revenue, 0)}
            days={30}
          />
        )}
        lowStock={<LowStockWidget />}
        expenses={<ExpensesWidget />}
        customerDues={customerDues}
        supplierPayments={isManager ? null : supplierPayments}
        labelsQuick={<LabelsQuickWidget />}
        customersQuick={<CustomersQuickWidget />}
        suppliersQuick={<SuppliersQuickWidget />}
      />
    </div>
  )
}
