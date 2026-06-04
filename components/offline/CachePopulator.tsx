'use client'

import { useEffect } from 'react'
import { cacheProductsLocally, cacheCustomersLocally } from '@/lib/offline/cache-sync'
import type { Product, Customer } from '@/types/database'

interface CachePopulatorProps {
  products: Product[]
  customers: Customer[]
}

export function CachePopulator({ products, customers }: CachePopulatorProps) {
  useEffect(() => {
    // Fire-and-forget; errors are non-fatal
    cacheProductsLocally(products).catch(() => {})
    cacheCustomersLocally(customers).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
