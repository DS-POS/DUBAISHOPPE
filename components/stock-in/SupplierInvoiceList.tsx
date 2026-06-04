'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchSupplier = (inv.supplier_name ?? '').toLowerCase().includes(q)
        const matchInvoice = (inv.purchase_invoice_no ?? '').toLowerCase().includes(q)
        if (!matchSupplier && !matchInvoice) return false
      }

      // Date range filter
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

  async function handleDelete(inv: SupplierInvoice) {
    const label = inv.purchase_invoice_no ?? inv.id
    const confirmed = window.confirm(
      `Delete invoice ${label}? This will reverse stock and cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(inv.id)
    try {
      await deleteSupplierInvoice(inv.id)
      setInvoices(prev => prev.filter(i => i.id !== inv.id))
      toast.success(`Invoice ${label} deleted successfully`)
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete invoice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search supplier or invoice no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-56"
        />
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
        {(search || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-500"
            onClick={() => { setSearch(''); setFromDate(''); setToDate('') }}
          >
            Clear
          </Button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {invoices.length} invoices
        </span>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No supplier invoices imported yet.{' '}
          <Link href="/stock-in/import" className="text-primary underline">Import one</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No invoices match your filters.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium">Invoice No</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium">Status</th>
                <th className="px-4 py-3 text-xs font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => {
                const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                const balance = Number(inv.total_amount) - paid
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-xs">
                      {inv.purchase_invoice_no ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {inv.supplier_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {format(parseISO(inv.purchase_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      <div>₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      {balance > 0 && (
                        <div className="text-red-500">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/stock-in/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7">View →</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-red-500 hover:text-red-700"
                          disabled={deletingId === inv.id}
                          onClick={() => handleDelete(inv)}
                        >
                          {deletingId === inv.id ? '…' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
