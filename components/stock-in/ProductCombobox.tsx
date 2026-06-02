'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDownIcon, SearchIcon, CheckIcon } from 'lucide-react'
import type { Product } from '@/types/database'

interface ProductComboboxProps {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  error?: boolean
}

export function ProductCombobox({ products, value, onChange, error }: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedProduct = products.find(p => p.id === value)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
    )
  }, [products, search])

  useEffect(() => {
    if (open) {
      // micro-delay so the element is painted before focus
      const t = setTimeout(() => searchRef.current?.focus(), 10)
      return () => clearTimeout(t)
    } else {
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* ── Trigger ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={[
          'h-9 w-full rounded-lg border bg-transparent px-3 text-sm text-left',
          'flex items-center justify-between gap-2 outline-none transition-all duration-150',
          open
            ? 'border-ring ring-3 ring-ring/50'
            : error
            ? 'border-destructive ring-3 ring-destructive/20'
            : 'border-input hover:border-ring/50',
        ].join(' ')}
      >
        {/* Left: product label */}
        {selectedProduct ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate text-foreground font-medium">
              {selectedProduct.name}
            </span>
            <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {selectedProduct.sku}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select a product…</span>
        )}

        {/* Right: chevron */}
        <ChevronDownIcon
          className={[
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open ? '-rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          className={[
            'absolute z-50 mt-1.5 w-full overflow-hidden',
            'rounded-xl border border-border bg-popover shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          ].join(' ')}
        >
          {/* Search row */}
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No products match &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="py-1">
                {filtered.map(p => {
                  const isSelected = p.id === value
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(p.id)
                        setOpen(false)
                      }}
                      className={[
                        'group w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left',
                        'transition-colors hover:bg-accent hover:text-accent-foreground',
                        isSelected ? 'bg-accent/40' : '',
                      ].join(' ')}
                    >
                      {/* Check mark */}
                      <CheckIcon
                        className={[
                          'size-3.5 shrink-0 transition-opacity',
                          isSelected ? 'opacity-100 text-primary' : 'opacity-0',
                        ].join(' ')}
                      />

                      {/* Name */}
                      <span className={['flex-1 truncate', isSelected ? 'font-medium' : ''].join(' ')}>
                        {p.name}
                      </span>

                      {/* SKU badge */}
                      <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground group-hover:border-border/80">
                        {p.sku}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/70 px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length === products.length
                ? `${products.length} product${products.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${products.length} match`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
