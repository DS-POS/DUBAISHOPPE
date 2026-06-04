'use client'

import { useState, useMemo } from 'react'
import { UserIcon, SearchIcon, XIcon, PlusIcon } from 'lucide-react'
import type { Customer } from '@/types/database'

interface CustomerSelectorProps {
  customers: Customer[]
  selected: Customer | null
  onSelect: (customer: Customer | null) => void
  onAddNew?: () => void
}

export function CustomerSelector({ customers, selected, onSelect, onAddNew }: CustomerSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 10)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.business_name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.gstin ?? '').toLowerCase().includes(q)
    ).slice(0, 10)
  }, [customers, search])

  function handleSelect(c: Customer | null) {
    onSelect(c)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 h-11 text-sm hover:border-[#111827]/50 hover:bg-slate-50 shadow-sm transition-all"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-[#111827]/10' : 'bg-slate-100'}`}>
          <UserIcon className={`size-4 ${selected ? 'text-[#4B5563]' : 'text-slate-400'}`} />
        </div>
        <span className={selected ? 'flex-1 text-left font-semibold text-slate-900 truncate' : 'flex-1 text-left text-slate-400'}>
          {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}` : 'Walk-in customer'}
        </span>
        {selected && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleSelect(null) }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <SearchIcon className="size-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors text-slate-500 border-b border-slate-100"
            >
              Walk-in (no customer)
            </button>
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.business_name ? `${c.business_name} · ` : ''}
                  {c.phone ?? ''}
                  {c.state !== 'Telangana' ? ` · ${c.state}` : ''}
                </p>
              </button>
            ))}
            {onAddNew && (
              <button
                type="button"
                onClick={() => { setOpen(false); onAddNew() }}
                className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 text-[#4B5563] hover:bg-[#F3F4F6] transition-colors font-semibold border-t border-slate-100"
              >
                <PlusIcon className="size-3.5" />
                Add New Customer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
