'use client'

import React from 'react'
import { SearchIcon } from 'lucide-react'
import type { Category } from '@/types/database'

interface ProductSearchProps {
  categories: Category[]
  onSearchChange: (search: string) => void
  onCategoryChange: (categoryId: string) => void
  onStatusChange: (status: string) => void
  searchValue: string
  categoryValue: string
  statusValue: string
}

export function ProductSearch({
  categories,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  searchValue,
  categoryValue,
  statusValue,
}: ProductSearchProps) {
  return (
    <div className="bg-white rounded-2xl p-4 ring-1 ring-black/[0.06] shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode..."
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] placeholder:text-slate-400"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryValue}
          onChange={e => onCategoryChange(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] min-w-[160px]"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusValue}
          onChange={e => onStatusChange(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] min-w-[140px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {(searchValue || categoryValue !== 'all' || statusValue !== 'all') && (
          <button
            onClick={() => { onSearchChange(''); onCategoryChange('all'); onStatusChange('all') }}
            className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
