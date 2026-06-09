'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import * as XLSX from 'xlsx'
import {
  SearchIcon, DownloadIcon, XIcon, FileTextIcon,
  UsersIcon, ListIcon,
} from 'lucide-react'
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
  const [groupByCustomer, setGroupByCustomer] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const hasActiveFilters = search.trim() !== '' || fromDate !== '' || toDate !== ''

  const filtered = useMemo(() => {
    return initialInvoices.filter(inv => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchInvoice = inv.invoice_no.toLowerCase().includes(q)
        const matchCustomer = inv.customers?.name.toLowerCase().includes(q) ?? false
        const matchPhone = inv.customers?.phone?.toLowerCase().includes(q) ?? false
        if (!matchInvoice && !matchCustomer && !matchPhone) return false
      }
      if (fromDate) {
        const from = startOfDay(new Date(fromDate))
        if (isBefore(parseISO(inv.created_at), from)) return false
      }
      if (toDate) {
        const to = endOfDay(new Date(toDate))
        if (isAfter(parseISO(inv.created_at), to)) return false
      }
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

  const grouped = useMemo(() => {
    if (!groupByCustomer) return null
    const map = new Map<string, { name: string; phone?: string; invoices: InvoiceWithCustomer[] }>()
    for (const inv of filtered) {
      const key = inv.customers?.name ?? 'Walk-in'
      if (!map.has(key)) {
        map.set(key, { name: key, phone: inv.customers?.phone ?? undefined, invoices: [] })
      }
      map.get(key)!.invoices.push(inv)
    }
    return Array.from(map.values()).sort((a, b) => {
      const latestA = Math.max(...a.invoices.map(i => new Date(i.created_at).getTime()))
      const latestB = Math.max(...b.invoices.map(i => new Date(i.created_at).getTime()))
      return latestB - latestA
    })
  }, [filtered, groupByCustomer])

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
      'Due': Math.max(0, inv.grand_total - (inv.total_returns ?? 0) - inv.amount_paid),
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
      'Due': Math.max(0, inv.grand_total - (inv.total_returns ?? 0) - inv.amount_paid),
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

  function renderInvoiceRow(inv: InvoiceWithCustomer, rowNum?: number) {
    const due = Math.max(0, inv.grand_total - (inv.total_returns ?? 0) - inv.amount_paid)
    const isSplitOrder = !!inv.order_group_id
    return (
      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
        <td className="px-3 py-3.5 text-xs text-slate-300 text-center tabular-nums w-8">
          {rowNum !== undefined ? rowNum : ''}
        </td>
        <td className="px-5 py-3.5 text-sm whitespace-nowrap">
          <Link href={`/invoices/${inv.id}`} className="font-mono text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:underline">
            {inv.invoice_no}
          </Link>
        </td>
        <td className="px-5 py-3.5 text-sm">
          <span className="font-semibold text-slate-900">{inv.customers?.name ?? 'Walk-in'}</span>
          {inv.customers?.phone && <p className="text-xs text-slate-400 mt-0.5">{inv.customers.phone}</p>}
        </td>
        <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
          <p>{format(parseISO(inv.created_at), 'dd MMM yyyy')}</p>
          <p className="text-xs text-slate-400">{format(parseISO(inv.created_at), 'hh:mm a')}</p>
        </td>
        <td className="px-5 py-3.5 text-sm">
          {inv.payment_method === 'insurance' ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              🛡 Insurance
            </span>
          ) : (
            <span className="capitalize text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {inv.payment_method ?? '—'}
            </span>
          )}
        </td>
        <td className="px-5 py-3.5 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">
          ₹{inv.grand_total.toFixed(2)}
        </td>
        <td className="px-5 py-3.5 text-sm text-right text-slate-500 whitespace-nowrap">
          ₹{inv.amount_paid.toFixed(2)}
        </td>
        <td className="px-5 py-3.5 text-sm text-right whitespace-nowrap">
          {isSplitOrder
            ? <span className="text-slate-300 text-xs">↑ group</span>
            : due > 0
              ? <span className="font-bold text-red-600">₹{due.toFixed(2)}</span>
              : <span className="text-slate-400">—</span>
          }
        </td>
        <td className="px-5 py-3.5 text-sm text-center">
          <StatusBadge status={inv.status} />
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Colored Page Header */}
      <div className="rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#111827] via-[#1e2d40] to-[#1a3a5c] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Invoices</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                {filtered.length === initialInvoices.length
                  ? `${initialInvoices.length} invoice${initialInvoices.length !== 1 ? 's' : ''}`
                  : `${filtered.length} of ${initialInvoices.length} invoices`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href="/billing">
                <button className="bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-900 font-bold px-3 py-2 rounded-xl shadow-sm transition-all text-xs sm:text-sm">
                  + New
                </button>
              </Link>
              <button
                onClick={exportExcel}
                disabled={filtered.length === 0}
                className="border border-white/20 bg-white/10 hover:bg-white/20 text-white font-medium px-2.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1 disabled:opacity-40"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                XLS
              </button>
              <button
                onClick={exportCSV}
                disabled={filtered.length === 0}
                className="border border-white/20 bg-white/10 hover:bg-white/20 text-white font-medium px-2.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1 disabled:opacity-40"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 ring-1 ring-black/[0.06] shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 flex-1 sm:w-32 rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" />
            </div>
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 flex-1 sm:w-32 rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]" />
            </div>
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-xs font-medium transition-all shadow-sm">
                <XIcon className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            <button
              onClick={() => setGroupByCustomer(g => !g)}
              className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-medium transition-all shadow-sm ${
                groupByCustomer
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {groupByCustomer ? <UsersIcon className="h-3.5 w-3.5" /> : <ListIcon className="h-3.5 w-3.5" />}
              {groupByCustomer ? 'Grouped' : 'Flat'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
        {STATUS_TABS.map(tab => {
          const count = counts[tab.key]
          const isActive = statusFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                isActive ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-700'
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

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileTextIcon className="size-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">
                {hasActiveFilters || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {!hasActiveFilters && statusFilter === 'all' ? 'Create your first invoice to get started' : 'Try adjusting your filters'}
              </p>
            </div>
            {!hasActiveFilters && statusFilter === 'all' && (
              <Link href="/billing" className="text-sm text-[#4B5563] hover:text-[#111827] hover:underline font-medium">
                Start billing →
              </Link>
            )}
            {(hasActiveFilters || statusFilter !== 'all') && (
              <button onClick={() => { clearFilters(); setStatusFilter('all') }} className="text-sm text-[#4B5563] hover:text-[#111827] hover:underline font-medium">
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          {/* Mobile: compact cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {groupByCustomer && grouped ? (
              grouped.map(group => {
                const isOpen = expanded.has(group.name)
                const groupTotal = group.invoices.reduce((s, i) => s + i.grand_total, 0)
                const groupNet = Math.round(group.invoices.reduce((s, i) => s + i.grand_total - (i.total_returns ?? 0) - i.amount_paid, 0) * 100) / 100
                const allPaid = group.invoices.every(i => i.status === 'paid')
                const hasDue = groupNet > 0
                return (
                  <Fragment key={`mgroup-${group.name}`}>
                    <div
                      onClick={() => setExpanded(prev => {
                        const next = new Set(prev)
                        if (isOpen) next.delete(group.name); else next.add(group.name)
                        return next
                      })}
                      className="px-4 py-3 bg-gradient-to-r from-blue-50 to-slate-50 cursor-pointer active:from-blue-100 select-none transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`text-slate-400 text-[10px] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-slate-900 truncate">{group.name}</p>
                            {group.phone && <p className="text-xs text-slate-500 truncate">{group.phone}</p>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">{group.invoices.length} inv</span>
                          <p className="font-bold text-sm text-slate-900 tabular-nums">₹{groupTotal.toFixed(2)}</p>
                          {hasDue
                            ? <span className="text-xs font-bold text-red-600 tabular-nums">Due ₹{groupNet.toFixed(2)}</span>
                            : allPaid
                              ? <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">All Paid</span>
                              : null
                          }
                        </div>
                      </div>
                    </div>
                    {isOpen && group.invoices.map(inv => {
                      const due = Math.max(0, inv.grand_total - (inv.total_returns ?? 0) - inv.amount_paid)
                      return (
                        <div key={inv.id} className="px-4 py-3 pl-11 bg-white border-l-2 border-blue-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <Link href={`/invoices/${inv.id}`} className="font-mono text-xs font-bold text-[#111827] hover:underline">{inv.invoice_no}</Link>
                              <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                              {inv.payment_method && (
                                <span className="text-xs text-slate-400 capitalize">{inv.payment_method}</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <p className="font-bold text-sm text-slate-900 tabular-nums">₹{inv.grand_total.toFixed(2)}</p>
                              {due > 0 && <p className="text-xs font-bold text-red-600 tabular-nums">Due ₹{due.toFixed(2)}</p>}
                              <StatusBadge status={inv.status} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })
            ) : (
              filtered.map(inv => {
                const due = Math.max(0, inv.grand_total - (inv.total_returns ?? 0) - inv.amount_paid)
                return (
                  <div key={inv.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-xs font-bold text-[#111827] hover:underline">{inv.invoice_no}</Link>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{inv.customers?.name ?? 'Walk-in'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="font-bold text-sm text-slate-900 tabular-nums">₹{inv.grand_total.toFixed(2)}</p>
                        {due > 0 && <p className="text-xs font-bold text-red-600 tabular-nums">Due ₹{due.toFixed(2)}</p>}
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Invoice No</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Payment</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Paid</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Due</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupByCustomer && grouped ? (
                  grouped.map((group, gi) => {
                    const isOpen = expanded.has(group.name)
                    const groupTotal = group.invoices.reduce((s, i) => s + i.grand_total, 0)
                    const groupPaid = group.invoices.reduce((s, i) => s + i.amount_paid, 0)
                    const groupNet = Math.round((group.invoices.reduce((s, i) => s + i.grand_total - (i.total_returns ?? 0) - i.amount_paid, 0)) * 100) / 100
                    const allPaid = group.invoices.every(i => i.status === 'paid')
                    const hasDue = groupNet > 0
                    return (
                    <Fragment key={`group-${group.name}`}>
                      <tr
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev)
                          if (isOpen) { next.delete(group.name) } else { next.add(group.name) }
                          return next
                        })}
                        className="bg-gradient-to-r from-blue-50 to-slate-50 border-y border-blue-100 cursor-pointer select-none hover:from-blue-100 hover:to-slate-100 transition-colors"
                      >
                        <td className="px-3 py-3 text-xs font-bold text-blue-400 text-center w-8">{gi + 1}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                            {group.invoices.length} inv
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-slate-400 text-[10px] inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm leading-tight">{group.name}</p>
                              {group.phone && <p className="text-xs text-slate-500 mt-0.5">{group.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3 text-right font-semibold text-slate-800 whitespace-nowrap tabular-nums">₹{groupTotal.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap tabular-nums">₹{groupPaid.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                          {hasDue ? <span className="font-bold text-red-600">₹{groupNet.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {allPaid
                            ? <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-semibold">All Paid</span>
                            : hasDue
                              ? <span className="bg-amber-50 text-amber-700 text-xs px-2.5 py-1 rounded-full font-semibold">Due</span>
                              : <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-semibold">Mixed</span>
                          }
                        </td>
                      </tr>
                      {isOpen && group.invoices.map((inv, ii) => renderInvoiceRow(inv, ii + 1))}
                    </Fragment>
                    )
                  })
                ) : (
                  filtered.map((inv, i) => renderInvoiceRow(inv, i + 1))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
