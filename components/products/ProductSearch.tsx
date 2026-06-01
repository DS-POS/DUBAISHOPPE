'use client'

import React from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, barcode..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Category filter */}
      <Select value={categoryValue} onValueChange={(val) => onCategoryChange(val as string)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusValue} onValueChange={(val) => onStatusChange(val as string)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
