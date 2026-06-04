'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import * as XLSX from 'xlsx'
import { SearchIcon, DownloadIcon, XIcon, FileTextIcon } from 'lucide-react'
import type { Invoice } from '@/types/database'

type InvoiceWithCustomer = Invoice & { customers: { name: string; phone: string | null } | null }

type StatusFilter = 'all' | 'pending' | 'paid' | 'cancelled'

interface Props {
  initialInvoices: InvoiceWithCustomer[]
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Due' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full text-xs">
        Paid
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="bg-slate-100 text-slate-500 font-semibold px-2.5 py-0.5 rounded-full text-xs">
        Cancelled
      </span>
    )
  }
  return (
    <span className="bg-amber-50 text-amber-700 font-semibold px-2.5 py-0.5 rounded-full text-xs">
      Due
    </span>
  )
}

export default function InvoiceList({ initialInvoices }: Props) {
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const hasActiveFilters = search.trim() !== '' || fromDate !== '' || toDate !== ''

  const filtered = useMemo(() => {
    return initialInvoices.filter(inv => {
      // search
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchInvoice = inv.invoice_no.toLowerCase().includes(q)
        const matchCustomer = inv.customers?.name.toLowerCase().includes(q) ?? false
        const matchPhone = inv.customers?.phone?.toLowerCase().includes(q) ?? false
        if (!matchInvoice && !matchCustomer && !matchPhone) return false
      }
      // date range
      if (fromDate) {
        const from = startOfDay(new Date(fromDate))
        if (isBefore(parseISO(inv.created_at), from)) return false
      }
      if (toDate) {
        const to = endOfDay(new Date(toDate))
        if (isAfter(parseISO(inv.created_at), to)) return false
      }
      // status tab
      if (statusFilter !== 'all') {
        if (inv.status !== statusFilter) return false
      }
      return true
    })
  }, [initialInvoices, search, fromDate, toDate, statusFilter])

  const counts = useMemo(() => ({
    all: initialInvoices.length,
    pending: initialInvoices.filter(i => i.status === 'pending').length,
    paid: initialInvoices.filter(i => i.status === 'paid').length,
    cancelled: initialInvoices.filter(i => i.status === 'cancelled').length,
  }), [initialInvoices])

  function clearFilters() {
    setSearch('')
    setFromDate('')
    setToDate('')
  }

  function exportExcel() {
    const rows = filtered.map(inv => ({
      'Invoice No': inv.invoice_no,
      'Customer': inv.customers?.name ?? 'Walk-in',
      'Phone': inv.customers?.phone ?? '',
      'Date': format(parseISO(inv.created_at), 'dd/MM/yyyy'),
      'Payment Method': inv.payment_method ?? '',
      'Subtotal': inv.subtotal,
      'Discount': inv.discount,
      'Total GST': inv.total_gst,
      'Grand Total': inv.grand_total,
      'Amount Paid': inv.amount_paid,
      'Due': Math.max(0, inv.grand_total - inv.amount_paid),
      'Status': inv.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
    XLSX.writeFile(wb, `invoices-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  function exportCSV() {
    const rows = filtered.map(inv => ({
      'Invoice No': inv.invoice_no,
      'Customer': inv.customers?.name ?? 'Walk-in',
      'Phone': inv.customers?.phone ?? '',
      'Date': format(parseISO(inv.created_at), 'dd/MM/yyyy'),
      'Payment Method': inv.payment_method ?? '',
      'Grand Total': inv.grand_total,
      'Amount Paid': inv.amount_paid,
      'Due': Math.max(0, inv.grand_total - inv.amount_paid),
      'Status': inv.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length === initialInvoices.length
              ? `${initialInvoices.length} invoice${initialInvoices.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${initialInvoices.length} invoices`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/billing">
            <button className="bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm">
              + New Invoice
            </button>
          </Link>
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice no or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 whitespace-nowrap">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 whitespace-nowrap">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] w-36"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-sm font-medium transition-all shadow-sm"
            >
              <XIcon className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => {
          const count = counts[tab.key]
          const isActive = statusFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                isActive
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileTextIcon className="size-6 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">
                {hasActiveFilters || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                {!hasActiveFilters && statusFilter === 'all' ? 'Create your first invoice to get started' : 'Try adjusting your filters'}
              </p>
            </div>
            {!hasActiveFilters && statusFilter === 'all' && (
              <Link href="/billing" className="text-sm text-[#4B5563] hover:text-[#111827] hover:underline font-medium">
                Start billing →
              </Link>
            )}
            {(hasActiveFilters || statusFilter !== 'all') && (
              <button
                onClick={() => { clearFilters(); setStatusFilter('all') }}
                className="text-sm text-[#4B5563] hover:text-[#111827] hover:underline font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Invoice No
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Payment
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Total
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Paid
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    Due
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => {
                  const due = Math.max(0, inv.grand_total - inv.amount_paid)
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-sm whitespace-nowrap">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:underline"
                        >
                          {inv.invoice_no}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <span className="font-semibold text-slate-900">
                          {inv.customers?.name ?? 'Walk-in'}
                        </span>
                        {inv.customers?.phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{inv.customers.phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {format(parseISO(inv.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <span className="capitalize text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {inv.payment_method ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">
                        ₹{inv.grand_total.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right text-slate-500 whitespace-nowrap">
                        ₹{inv.amount_paid.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right whitespace-nowrap">
                        {due > 0 ? (
                          <span className="font-bold text-red-600">₹{due.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
