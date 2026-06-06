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
}

export default function SupplierInvoiceList({ initialInvoices }: Props) {
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

  function renderRow(inv: SupplierInvoice) {
    const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const balance = Number(inv.total_amount) - paid
    return (
      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
        <td className="px-5 py-3.5 text-sm font-mono font-medium text-slate-700">{inv.purchase_invoice_no ?? '—'}</td>
        <td className="px-5 py-3.5 text-sm text-slate-600">{inv.supplier_name ?? '—'}</td>
        <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(inv.purchase_date), 'dd MMM yyyy')}</td>
        <td className="px-5 py-3.5 text-sm text-right tabular-nums">
          <div className="font-semibold text-slate-900">₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          {balance > 0 && <div className="text-red-500 text-xs">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
        </td>
        <td className="px-5 py-3.5 text-center">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>{inv.payment_status}</span>
        </td>
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <Link href={`/stock-in/${inv.id}`} className="text-xs font-medium text-[#4B5563] hover:underline">View →</Link>
            <button
              className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
              disabled={deletingId === inv.id}
              onClick={() => handleDelete(inv)}
            >
              {deletingId === inv.id ? '…' : 'Delete'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search supplier or invoice no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
            />
          </div>
          <label className="text-sm text-slate-500 whitespace-nowrap">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 w-36" />
          <label className="text-sm text-slate-500 whitespace-nowrap">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 w-36" />
          {(search || fromDate || toDate) && (
            <button onClick={() => { setSearch(''); setFromDate(''); setToDate('') }} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm hover:bg-slate-50 transition-colors">Clear</button>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setGroupBySupplier(g => !g)}
              className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition-all shadow-sm ${
                groupBySupplier ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {groupBySupplier ? '▼ By Supplier' : '≡ Flat List'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <p className="text-sm text-slate-500">No supplier invoices yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <p className="text-sm text-slate-500">No invoices match your filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] border-b border-[#1F2937]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice No</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupBySupplier && grouped ? (
                  grouped.map(group => {
                    const isOpen = expanded.has(group.name)
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
                          <td colSpan={6} className="px-5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-slate-400 text-xs inline-block transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <span className="text-white text-xs font-bold">{group.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                              <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                {group.items.length} invoice{group.items.length !== 1 ? 's' : ''}
                              </span>
                              <span className="ml-auto text-xs font-semibold text-slate-600">
                                ₹{group.items.reduce((s, i) => s + Number(i.total_amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {isOpen && group.items.map(inv => renderRow(inv))}
                      </Fragment>
                    )
                  })
                ) : (
                  filtered.map(inv => renderRow(inv))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
