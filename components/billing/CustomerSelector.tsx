'use client'

import { useState, useMemo } from 'react'
import { UserIcon, SearchIcon, XIcon } from 'lucide-react'
import type { Customer } from '@/types/database'

interface CustomerSelectorProps {
  customers: Customer[]
  selected: Customer | null
  onSelect: (customer: Customer | null) => void
}

export function CustomerSelector({ customers, selected, onSelect }: CustomerSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 10)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
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
        className="w-full flex items-center gap-2.5 rounded-lg border border-input bg-background px-3 h-10 text-sm hover:border-ring/50 transition-colors"
      >
        <UserIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className={selected ? 'flex-1 text-left font-medium truncate' : 'flex-1 text-left text-muted-foreground'}>
          {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}` : 'Walk-in customer'}
        </span>
        {selected && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleSelect(null) }}
            className="text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <SearchIcon className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors text-muted-foreground"
            >
              Walk-in (no customer)
            </button>
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone ?? ''} {c.state !== 'Telangana' ? `· ${c.state}` : ''}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
