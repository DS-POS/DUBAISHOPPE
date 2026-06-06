'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PlusIcon, SearchIcon, DownloadIcon, UsersIcon } from 'lucide-react'
import { deleteCustomer } from '@/actions/customers'
import type { Customer } from '@/types/database'
import * as XLSX from 'xlsx'
import { format, parseISO } from 'date-fns'

interface Props {
  initialCustomers: Customer[]
}

export default function CustomerList({ initialCustomers }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = search.trim()
    ? customers.filter(c => {
        const q = search.trim().toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone?.toLowerCase().includes(q) ?? false) ||
          (c.business_name?.toLowerCase().includes(q) ?? false)
        )
      })
    : customers

  function exportCustomers(formatType: 'xlsx' | 'csv') {
    const rows = filtered.map(c => ({
      'Name': c.name,
      'Business Name': c.business_name ?? '',
      'Phone': c.phone ?? '',
      'Email': c.email ?? '',
      'State': c.state,
      'GSTIN': c.gstin ?? '',
      'Address': c.address ?? '',
      'Created At': format(parseISO(c.created_at), 'dd/MM/yyyy'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    const fileName = `customers-${format(new Date(), 'yyyy-MM-dd')}`
    if (formatType === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`)
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  function handleDelete(customer: Customer) {
    if (!window.confirm(`Delete customer ${customer.name}?`)) return
    startTransition(async () => {
      try {
        await deleteCustomer(customer.id)
        setCustomers(prev => prev.filter(c => c.id !== customer.id))
        toast.success('Customer deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete customer')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCustomers('xlsx')}
            disabled={filtered.length === 0}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to Excel"
          >
            <DownloadIcon className="size-3.5" />
            Excel
          </button>
          <button
            onClick={() => exportCustomers('csv')}
            disabled={filtered.length === 0}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to CSV"
          >
            <DownloadIcon className="size-3.5" />
            CSV
          </button>
          <Link href="/customers/new">
            <span className="bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-sm flex items-center gap-1.5 cursor-pointer">
              <PlusIcon className="size-4" />
              Add Customer
            </span>
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
        <div className="relative max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, or business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <UsersIcon className="size-6 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">
                {search.trim() ? 'No customers match your search' : 'No customers yet'}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                {search.trim() ? 'Try a different search term' : 'Add your first customer to get started'}
              </p>
            </div>
            {!search.trim() && (
              <Link href="/customers/new">
                <span className="bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-sm inline-flex items-center gap-1.5 cursor-pointer mt-1">
                  <PlusIcon className="size-4" />
                  Add First Customer
                </span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isOpen = expanded.has(c.id)
            return (
              <div key={c.id} className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
                <div
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    if (isOpen) { next.delete(c.id) } else { next.add(c.id) }
                    return next
                  })}
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{c.name}</p>
                    {c.business_name && <p className="text-xs text-slate-500">{c.business_name}</p>}
                  </div>
                  <p className="text-sm text-slate-500 hidden sm:block">{c.phone ?? '—'}</p>
                  <p className="text-sm text-slate-500 hidden md:block truncate max-w-[180px]">{c.email ?? '—'}</p>
                  <p className="text-xs text-slate-400 hidden lg:block">{c.state}</p>
                  <span
                    className="text-slate-300 ml-2 text-xs inline-block transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >▶</span>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-4">
                      {c.phone && (
                        <div><p className="text-xs text-slate-400 font-medium">Phone</p><p className="font-semibold text-slate-800">{c.phone}</p></div>
                      )}
                      {c.email && (
                        <div><p className="text-xs text-slate-400 font-medium">Email</p><p className="font-semibold text-slate-800 break-all">{c.email}</p></div>
                      )}
                      {c.state && (
                        <div><p className="text-xs text-slate-400 font-medium">State</p><p className="font-semibold text-slate-800">{c.state}</p></div>
                      )}
                      {c.gstin && (
                        <div><p className="text-xs text-slate-400 font-medium">GSTIN</p><p className="font-mono text-xs font-semibold text-slate-800">{c.gstin}</p></div>
                      )}
                      {c.address && (
                        <div className="col-span-2 sm:col-span-3"><p className="text-xs text-slate-400 font-medium">Address</p><p className="font-semibold text-slate-800">{c.address}</p></div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <Link href={`/customers/${c.id}`} className="text-xs font-semibold text-blue-600 hover:underline">View Details</Link>
                      <Link href={`/customers/${c.id}/edit`} className="text-xs font-medium text-slate-500 hover:underline">Edit</Link>
                      <button onClick={() => handleDelete(c)} disabled={pending} className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
