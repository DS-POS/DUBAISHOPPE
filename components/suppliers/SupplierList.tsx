'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteSupplier } from '@/actions/suppliers'
import type { Supplier } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlusIcon, SearchIcon, DownloadIcon, TruckIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import { format, parseISO } from 'date-fns'

interface Props {
  initialSuppliers: Supplier[]
}

export default function SupplierList({ initialSuppliers }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [, startTransition] = useTransition()

  const filtered = search.trim()
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.gstin ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.business_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : suppliers

  function exportSuppliers(formatType: 'xlsx' | 'csv') {
    const rows = filtered.map(s => ({
      'Name': s.name,
      'Business Name': s.business_name ?? '',
      'Phone': s.phone ?? '',
      'Email': s.email ?? '',
      'State': s.state,
      'GSTIN': s.gstin ?? '',
      'Address': s.address ?? '',
      'Notes': s.notes ?? '',
      'Created At': format(parseISO(s.created_at), 'dd/MM/yyyy'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
    const fileName = `suppliers-${format(new Date(), 'yyyy-MM-dd')}`
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

  function handleDelete(supplier: Supplier) {
    if (!window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return
    setSuppliers(prev => prev.filter(s => s.id !== supplier.id))
    startTransition(async () => {
      try {
        await deleteSupplier(supplier.id)
        toast.success('Supplier deleted.')
        router.refresh()
      } catch (err) {
        setSuppliers(initialSuppliers)
        toast.error(err instanceof Error ? err.message : 'Failed to delete supplier.')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Suppliers
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSuppliers('xlsx')}
            disabled={filtered.length === 0}
            title="Export to Excel"
            className="h-9 text-xs px-2.5"
          >
            <DownloadIcon className="size-3 mr-1" />
            XLS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSuppliers('csv')}
            disabled={filtered.length === 0}
            title="Export to CSV"
            className="h-9 text-xs px-2.5"
          >
            <DownloadIcon className="size-3 mr-1" />
            CSV
          </Button>
          <Link href="/suppliers/new">
            <Button className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white h-9 text-xs sm:text-sm">
              <PlusIcon className="size-3.5 mr-1.5" />
              Add
            </Button>
          </Link>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <TruckIcon className="size-6 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">No suppliers yet</p>
              <p className="text-sm text-slate-400 mt-0.5">Add your first supplier to get started</p>
            </div>
            <Link href="/suppliers/new">
              <Button className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white mt-1">
                <PlusIcon className="size-4 mr-1.5" />
                Add First Supplier
              </Button>
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <TruckIcon className="size-6 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">No suppliers match your search</p>
              <p className="text-sm text-slate-400 mt-0.5">Try a different search term</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Mobile: card list */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filtered.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-900 truncate">{s.name}</p>
                  {s.business_name && <p className="text-xs text-slate-500 truncate">{s.business_name}</p>}
                  {s.phone && <p className="text-xs text-slate-400 mt-0.5">{s.phone}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/suppliers/${s.id}`} className="text-xs font-semibold text-slate-900 underline">View</Link>
                  <Link href={`/suppliers/${s.id}/edit`} className="text-xs text-slate-500 hover:underline">Edit</Link>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 uppercase tracking-wide text-xs">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 uppercase tracking-wide text-xs">Business Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 uppercase tracking-wide text-xs">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 uppercase tracking-wide text-xs">GSTIN</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300 uppercase tracking-wide text-xs">State</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-300 uppercase tracking-wide text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="bg-white hover:bg-slate-50/70 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.business_name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.gstin ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.state}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link href={`/suppliers/${s.id}`} className="text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors">View</Link>
                      <Link href={`/suppliers/${s.id}/edit`} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Edit</Link>
                      <button onClick={() => handleDelete(s)} className="text-xs text-destructive hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
