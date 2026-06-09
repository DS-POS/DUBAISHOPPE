'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { deleteSupplierInvoice } from '@/actions/supplier-invoices'
import type { SupplierInvoice } from '@/types/database'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
}

interface Props {
  initialInvoices: SupplierInvoice[]
  userRole?: string
}

export default function SupplierInvoiceList({ initialInvoices, userRole }: Props) {
  const isManager = userRole === 'manager'
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(initialInvoices)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [groupBySupplier, setGroupBySupplier] = useState(true)

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchSupplier = (inv.supplier_name ?? '').toLowerCase().includes(q)
        const matchInvoice = (inv.purchase_invoice_no ?? '').toLowerCase().includes(q)
        if (!matchSupplier && !matchInvoice) return false
      }
      if (fromDate || toDate) {
        const invDate = parseISO(inv.purchase_date)
        if (fromDate) {
          const from = startOfDay(parseISO(fromDate))
          if (invDate < from) return false
        }
        if (toDate) {
          const to = endOfDay(parseISO(toDate))
          if (invDate > to) return false
        }
      }
      return true
    })
  }, [invoices, search, fromDate, toDate])

  const grouped = useMemo(() => {
    if (!groupBySupplier) return null
    const map = new Map<string, SupplierInvoice[]>()
    for (const inv of filtered) {
      const key = inv.supplier_name ?? 'Unknown Supplier'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(inv)
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [filtered, groupBySupplier])

  async function handleDelete(inv: SupplierInvoice) {
    const label = inv.purchase_invoice_no ?? inv.id
    if (!window.confirm(`Delete invoice ${label}? This will reverse stock and cannot be undone.`)) return
    setDeletingId(inv.id)
    try {
      await deleteSupplierInvoice(inv.id)
      setInvoices(prev => prev.filter(i => i.id !== inv.id))
      toast.success(`Invoice ${label} deleted`)
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeletingId(null)
    }
  }

  function renderRow(inv: SupplierInvoice, rowNum?: number) {
    const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const balance = Number(inv.total_amount) - paid
    return (
      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
        <td className="px-3 py-3.5 text-xs text-slate-300 text-center tabular-nums w-8">
          {rowNum !== undefined ? rowNum : ''}
        </td>
        <td className="px-5 py-3.5 text-sm font-mono font-medium text-slate-700">{inv.purchase_invoice_no ?? '—'}</td>
        <td className="px-5 py-3.5 text-sm text-slate-600">{inv.supplier_name ?? '—'}</td>
        <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(inv.purchase_date), 'dd MMM yyyy')}</td>
        <td className="px-5 py-3.5 text-sm text-right tabular-nums">
          <div className="font-semibold text-slate-900">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          {!isManager && balance > 0 && <div className="text-red-500 text-xs">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
        </td>
        {!isManager && (
          <td className="px-5 py-3.5 text-center">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>{inv.payment_status}</span>
          </td>
        )}
        {isManager && <td />}
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <Link href={`/stock-in/${inv.id}`} className="text-xs font-medium text-[#4B5563] hover:underline">View →</Link>
            {!isManager && (
              <button
                className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
                disabled={deletingId === inv.id}
                onClick={() => handleDelete(inv)}
              >
                {deletingId === inv.id ? '…' : 'Delete'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 ring-1 ring-black/[0.06] shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search supplier or invoice…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20" />
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20" />
            </div>
            {(search || fromDate || toDate) && (
              <button onClick={() => { setSearch(''); setFromDate(''); setToDate('') }} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs hover:bg-slate-50 transition-colors">Clear</button>
            )}
            <button
              onClick={() => setGroupBySupplier(g => !g)}
              className={`h-10 px-3 rounded-xl border text-xs font-medium transition-all shadow-sm ${
                groupBySupplier ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {groupBySupplier ? 'Grouped' : 'Flat'}
            </button>
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      {invoices.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-10 text-center">
          <p className="text-sm text-slate-500">No supplier invoices yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-10 text-center">
          <p className="text-sm text-slate-500">No invoices match your filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          {/* Mobile: grouped collapsible cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {groupBySupplier && grouped ? (
              grouped.map(group => {
                const isOpen = expanded.has(group.name)
                const groupTotal = group.items.reduce((s, i) => s + Number(i.total_amount), 0)
                const groupPaid = group.items.reduce((s, i) => (i.supplier_payments ?? []).reduce((sp, p) => sp + Number(p.amount), s), 0)
                const groupDue = groupTotal - groupPaid
                const allPaid = group.items.every(i => i.payment_status === 'paid')
                return (
                  <Fragment key={`mgroup-${group.name}`}>
                    <div
                      onClick={() => setExpanded(prev => {
                        const next = new Set(prev)
                        if (isOpen) next.delete(group.name); else next.add(group.name)
                        return next
                      })}
                      className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white cursor-pointer active:from-slate-100 select-none transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`text-slate-400 text-[10px] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <p className="font-bold text-sm text-slate-900 truncate min-w-0 flex-1">{group.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">{group.items.length} inv</span>
                          <p className="font-bold text-sm text-slate-900 tabular-nums">₹{groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                          {!isManager && (groupDue > 0.005
                            ? <span className="text-xs font-bold text-red-600 tabular-nums">Due ₹{groupDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            : allPaid ? <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">All Paid</span> : null
                          )}
                        </div>
                      </div>
                    </div>
                    {isOpen && group.items.map(inv => {
                      const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                      const balance = Number(inv.total_amount) - paid
                      return (
                        <div key={inv.id} className="px-4 py-3 pl-11 bg-white border-l-2 border-slate-300 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-semibold text-[#111827] truncate">{inv.purchase_invoice_no ?? '—'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.purchase_date), 'dd MMM yyyy')}</p>
                            {!isManager && balance > 0.005 && <p className="text-xs font-bold text-red-600 mt-0.5">Due ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p className="font-bold text-sm text-slate-900 tabular-nums">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            {!isManager && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>{inv.payment_status}</span>}
                            <Link href={`/stock-in/${inv.id}`} className="text-xs font-semibold text-[#111827] underline">View</Link>
                          </div>
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })
            ) : (
              filtered.map(inv => {
                const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                const balance = Number(inv.total_amount) - paid
                return (
                  <div key={inv.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-[#111827] truncate">{inv.purchase_invoice_no ?? '—'}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{inv.supplier_name ?? '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{format(parseISO(inv.purchase_date), 'dd MMM yyyy')}</p>
                      {!isManager && balance > 0.005 && <p className="text-xs font-bold text-red-600 mt-0.5">Due ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="font-bold text-sm text-slate-900 tabular-nums">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      {!isManager && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>{inv.payment_status}</span>}
                      <Link href={`/stock-in/${inv.id}`} className="text-xs font-semibold text-[#111827] underline">View</Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice No</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                  {!isManager && <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>}
                  {isManager && <th />}
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupBySupplier && grouped ? (
                  grouped.map((group, gi) => {
                    const isOpen = expanded.has(group.name)
                    const groupTotal = group.items.reduce((s, i) => s + Number(i.total_amount), 0)
                    const groupPaid = group.items.reduce((s, i) => {
                      const paid = (i.supplier_payments ?? []).reduce((sp, p) => sp + Number(p.amount), 0)
                      return s + paid
                    }, 0)
                    const groupDue = groupTotal - groupPaid
                    const allPaid = group.items.every(i => i.payment_status === 'paid')
                    return (
                      <Fragment key={`group-${group.name}`}>
                        <tr
                          onClick={() => setExpanded(prev => {
                            const next = new Set(prev)
                            if (isOpen) { next.delete(group.name) } else { next.add(group.name) }
                            return next
                          })}
                          className="bg-gradient-to-r from-slate-50 to-white border-y border-slate-200 cursor-pointer select-none hover:from-slate-100 transition-colors"
                        >
                          <td className="px-3 py-3 text-xs font-bold text-slate-400 text-center w-8">{gi + 1}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">{group.items.length} inv</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-slate-400 text-[10px] inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3" />
                          <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                            <p className="font-semibold text-slate-900">₹{groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            {!isManager && groupDue > 0.005 && <p className="text-red-500 text-xs">Due: ₹{groupDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {!isManager && (allPaid
                              ? <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-semibold">All Paid</span>
                              : groupDue > 0.005
                                ? <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-semibold">Due</span>
                                : <span className="bg-yellow-100 text-yellow-700 text-xs px-2.5 py-1 rounded-full font-semibold">Partial</span>
                            )}
                          </td>
                          <td className="px-5 py-3" />
                        </tr>
                        {isOpen && group.items.map((inv, ii) => renderRow(inv, ii + 1))}
                      </Fragment>
                    )
                  })
                ) : (
                  filtered.map((inv, i) => renderRow(inv, i + 1))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
