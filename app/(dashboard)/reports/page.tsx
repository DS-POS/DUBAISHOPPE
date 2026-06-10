'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { getReportData, type ReportData } from '@/actions/reports'
import {
  TrendingUp,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  BarChart2,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toDateInput(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDateDisplay(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 29)
  return { from: toDateInput(from), to: toDateInput(to) }
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit',
  unknown: 'Unknown',
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#22c55e',
  upi: '#3b82f6',
  card: '#8b5cf6',
  bank_transfer: '#f59e0b',
  credit: '#ef4444',
  unknown: '#94a3b8',
}

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  bg,
  iconClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  bg: string
  iconClass: string
}) {
  return (
    <div className={`${bg} rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5`}>
      <div className={`inline-flex items-center justify-center ${iconClass} rounded-xl p-2 mb-3`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function DailyChart({ data }: { data: ReportData['dailyRevenue'] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.amount), 1)
  // Show at most 31 bars; if more, bin into weeks — but for <=31 show all
  const shown = data.slice(-31)

  return (
    <div>
      <div className="flex items-end gap-0.5 h-28" aria-label="Daily revenue chart">
        {shown.map((d) => {
          const pct = max > 0 ? (d.amount / max) * 100 : 0
          return (
            <div
              key={d.date}
              className="relative flex-1 flex flex-col items-center justify-end group"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded-lg whitespace-nowrap shadow">
                  {formatDateDisplay(d.date)}: ₹{formatINR(d.amount)}
                </div>
                <div className="border-4 border-transparent border-t-slate-900" />
              </div>
              <div
                className="w-full rounded-t min-h-[2px] transition-all"
                style={{
                  height: `${Math.max(pct, d.amount > 0 ? 4 : 1)}%`,
                  backgroundColor: d.amount > 0 ? '#1e293b' : '#E5E7EB',
                }}
              />
            </div>
          )
        })}
      </div>
      {/* X-axis labels — show first, middle, last */}
      <div className="flex justify-between mt-1 text-[10px] text-slate-400 select-none">
        <span>{shown[0] ? formatDateDisplay(shown[0].date) : ''}</span>
        <span>{shown[Math.floor(shown.length / 2)] ? formatDateDisplay(shown[Math.floor(shown.length / 2)].date) : ''}</span>
        <span>{shown[shown.length - 1] ? formatDateDisplay(shown[shown.length - 1].date) : ''}</span>
      </div>
    </div>
  )
}

function PaymentBreakdown({ data, total }: { data: ReportData['paymentBreakdown']; total: number }) {
  if (data.length === 0) return <p className="text-slate-400 text-sm">No data</p>

  return (
    <div className="space-y-2.5">
      {data.map((p) => {
        const pct = total > 0 ? (p.amount / total) * 100 : 0
        const color = PAYMENT_COLORS[p.method] ?? '#94a3b8'
        return (
          <div key={p.method}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">
                {PAYMENT_LABELS[p.method] ?? p.method}
              </span>
              <span className="text-slate-500 tabular-nums">
                {p.count} inv — ₹{formatINR(p.amount)}
                <span className="ml-1.5 text-xs text-slate-400">({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const defaults = getDefaultRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchData = useCallback((f: string, t: string) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await getReportData({ from: f, to: t })
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report data')
      }
    })
  }, [])

  // Load on mount
  useEffect(() => {
    fetchData(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyRange(f: string, t: string) {
    setFrom(f)
    setTo(t)
    fetchData(f, t)
  }

  function setQuickRange(days: 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth') {
    const today = new Date()
    let f: string, t: string
    if (days === 'today') {
      f = toDateInput(today)
      t = toDateInput(today)
    } else if (days === '7d') {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      f = toDateInput(start)
      t = toDateInput(today)
    } else if (days === '30d') {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      f = toDateInput(start)
      t = toDateInput(today)
    } else if (days === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      f = toDateInput(start)
      t = toDateInput(today)
    } else {
      // lastMonth
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      f = toDateInput(start)
      t = toDateInput(end)
    }
    applyRange(f, t)
  }

  // ── Export Excel ────────────────────────────────────────────────────────────
  function exportExcel() {
    if (!data) return
    const rows = data.invoices.map(inv => ({
      'Invoice No': inv.invoice_no,
      'Date': inv.created_at.split('T')[0],
      'Customer': inv.customer_name ?? 'Walk-in',
      'Payment Method': PAYMENT_LABELS[inv.payment_method ?? ''] ?? inv.payment_method ?? '',
      'Subtotal': inv.subtotal,
      'Discount': inv.discount,
      'Taxable Amount': inv.taxable_amount,
      'CGST': inv.cgst,
      'SGST': inv.sgst,
      'IGST': inv.igst,
      'Total GST': inv.total_gst,
      'Grand Total': inv.grand_total,
      'Amount Paid': inv.amount_paid,
      'Balance Due': Math.max(0, inv.grand_total - inv.amount_paid),
      'Status': inv.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
    XLSX.writeFile(wb, `ds-pos-report-${from}-to-${to}.xlsx`)
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!data) return
    const headers = [
      'Invoice No', 'Date', 'Customer', 'Payment Method',
      'Subtotal', 'Discount', 'Taxable Amount',
      'CGST', 'SGST', 'IGST', 'Total GST',
      'Grand Total', 'Amount Paid', 'Balance Due', 'Status',
    ]
    const rows = data.invoices.map(inv => [
      inv.invoice_no,
      inv.created_at.split('T')[0],
      inv.customer_name ?? 'Walk-in',
      PAYMENT_LABELS[inv.payment_method ?? ''] ?? inv.payment_method ?? '',
      inv.subtotal,
      inv.discount,
      inv.taxable_amount,
      inv.cgst,
      inv.sgst,
      inv.igst,
      inv.total_gst,
      inv.grand_total,
      inv.amount_paid,
      Math.max(0, inv.grand_total - inv.amount_paid),
      inv.status,
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ds-pos-report-${from}-to-${to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const quickBtns: { label: string; key: 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' }[] = [
    { label: 'Today', key: 'today' },
    { label: 'Last 7 days', key: '7d' },
    { label: 'Last 30 days', key: '30d' },
    { label: 'This Month', key: 'thisMonth' },
    { label: 'Last Month', key: 'lastMonth' },
  ]

  return (
    <div className="space-y-6 pb-16">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Business performance &amp; export</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportExcel}
            disabled={!data || isPending}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-200"
          >
            <Download className="size-4" />
            Export Excel
          </button>
          <button
            onClick={exportCSV}
            disabled={!data || isPending}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl ring-1 ring-slate-200 transition-colors"
          >
            <Download className="size-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Financial Reports Navigation */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Financial Reports</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: '/reports/profit-loss', label: 'Profit & Loss', desc: 'Income statement' },
            { href: '/reports/margins', label: 'Product Margins', desc: 'COGS & profitability' },
            { href: '/reports/day-end', label: 'Day-End Summary', desc: 'Daily closing report' },
            { href: '/reports/receivables', label: 'Accounts Receivable', desc: 'Customer aging' },
            { href: '/reports/payables', label: 'Accounts Payable', desc: 'Supplier balances' },
          ].map(r => (
            <Link key={r.href} href={r.href}
              className="flex flex-col gap-0.5 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 hover:border-slate-900/30 transition-colors">
              <span className="text-sm font-semibold text-slate-900">{r.label}</span>
              <span className="text-xs text-slate-400">{r.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Date range bar */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Quick range pills */}
          <div className="flex flex-wrap gap-1.5">
            {quickBtns.map(btn => (
              <button
                key={btn.key}
                onClick={() => setQuickRange(btn.key)}
                disabled={isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-900 hover:text-white disabled:opacity-40 text-slate-600 ring-1 ring-slate-200 transition-all duration-150"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-white"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-white"
              />
            </div>
            <button
              onClick={() => fetchData(from, to)}
              disabled={isPending}
              className="mt-5 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all duration-200"
            >
              <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isPending && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-100 rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5 animate-pulse h-28" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<TrendingUp className="size-4" />}
              label="Total Revenue"
              value={`₹${formatINR(data.totalRevenue)}`}
              sub={`Avg ₹${formatINR(data.averageOrderValue)} / order`}
              bg="bg-white"
              iconClass="icon-gradient-blue text-white"
            />
            <SummaryCard
              icon={<FileText className="size-4" />}
              label="Total Invoices"
              value={String(data.totalInvoices)}
              sub={`${from} – ${to}`}
              bg="bg-white"
              iconClass="icon-gradient-dark text-white"
            />
            <SummaryCard
              icon={<CheckCircle className="size-4" />}
              label="Total Collected"
              value={`₹${formatINR(data.totalPaid)}`}
              sub={`${data.totalRevenue > 0 ? ((data.totalPaid / data.totalRevenue) * 100).toFixed(1) : 0}% of revenue`}
              bg="bg-emerald-50"
              iconClass="icon-gradient-emerald text-white"
            />
            <SummaryCard
              icon={<AlertCircle className="size-4" />}
              label="Outstanding Due"
              value={`₹${formatINR(data.totalDue)}`}
              sub={data.totalDue > 0 ? 'Pending collection' : 'All cleared!'}
              bg={data.totalDue > 0 ? 'bg-rose-50' : 'bg-white'}
              iconClass={data.totalDue > 0 ? 'icon-gradient-red text-white' : 'icon-gradient-dark text-white'}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Daily Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="size-4 text-slate-500" />
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Daily Revenue</h2>
              </div>
              {data.dailyRevenue.every(d => d.amount === 0) ? (
                <div className="flex items-center justify-center h-28 text-slate-400 text-sm">
                  No sales in this period
                </div>
              ) : (
                <DailyChart data={data.dailyRevenue} />
              )}
            </div>

            {/* Payment Breakdown */}
            <div className="bg-slate-50 rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-4">Payment Methods</h2>
              <PaymentBreakdown data={data.paymentBreakdown} total={data.totalRevenue} />
            </div>
          </div>

          {/* Tables row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top Products */}
            <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">Top Products</h2>
                <p className="text-xs text-slate-400 mt-0.5">By revenue in selected period</p>
              </div>
              {data.topProducts.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">No sales data</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide w-8">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Product</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Qty</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topProducts.map((p, idx) => (
                        <tr key={p.product_name} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 text-sm truncate max-w-[180px]">{p.product_name}</p>
                            {p.sku && <p className="text-xs text-slate-400 font-mono">{p.sku}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{p.quantity}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                            ₹{formatINR(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-slate-100 rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-bold text-slate-900">Top Customers</h2>
                <p className="text-xs text-slate-400 mt-0.5">By spend in selected period</p>
              </div>
              {data.topCustomers.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">No customer data</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-200 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide w-8">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoices</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.topCustomers.map((c, idx) => (
                        <tr key={c.customer_name} className="hover:bg-slate-200/60 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 text-sm truncate max-w-[180px]">
                            {c.customer_name}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.invoice_count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                            ₹{formatINR(c.total_spend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* All Invoices table */}
          <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">All Invoices</h2>
                <p className="text-xs text-slate-400 mt-0.5">{data.invoices.length} invoices in selected period</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportExcel}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  Export Excel
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={exportCSV}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  Export CSV
                </button>
              </div>
            </div>
            {data.invoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No invoices in this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Invoice</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Method</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden lg:table-cell">Subtotal</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden lg:table-cell">GST</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden md:table-cell">Paid</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-rose-300 uppercase tracking-wide hidden md:table-cell">Due</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.invoices.map(inv => {
                      const due = Math.max(0, inv.grand_total - inv.amount_paid)
                      return (
                        <tr key={inv.invoice_no} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                            {inv.invoice_no}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                            {inv.created_at.split('T')[0]}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {inv.customer_name ?? 'Walk-in'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 capitalize hidden md:table-cell">
                            {PAYMENT_LABELS[inv.payment_method ?? ''] ?? inv.payment_method ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums hidden lg:table-cell">
                            ₹{formatINR(inv.subtotal)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums hidden lg:table-cell">
                            ₹{formatINR(inv.total_gst)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                            ₹{formatINR(inv.grand_total)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 tabular-nums hidden md:table-cell">
                            ₹{formatINR(inv.amount_paid)}
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            {due > 0 ? (
                              <span className="text-rose-600 font-semibold tabular-nums">₹{formatINR(due)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.status === 'pending'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
