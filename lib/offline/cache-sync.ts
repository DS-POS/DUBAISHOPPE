'use client'

import { getDB, type CachedProduct, type CachedCustomer } from './db'
import type { CreateInvoiceData } from '@/actions/invoices'

// ─── Cache population ──────────────────────────────────────────────────────

export async function cacheProductsLocally(products: Array<{
  id: string; name: string; sku: string; barcode?: string | null
  selling_price: number; cost_price: number; gst_rate: number
  hsn_code?: string | null; current_stock: number
  requires_serial?: boolean; track_serial?: boolean
  brand?: string | null; status: string; category_id?: string | null
}>): Promise<void> {
  const db = getDB()
  const now = Date.now()
  const rows: CachedProduct[] = products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    selling_price: p.selling_price,
    cost_price: p.cost_price,
    gst_rate: p.gst_rate,
    hsn_code: p.hsn_code ?? null,
    current_stock: p.current_stock,
    requires_serial: p.requires_serial ?? false,
    track_serial: p.track_serial ?? false,
    brand: p.brand ?? null,
    status: p.status,
    category_id: p.category_id ?? null,
    cached_at: now,
  }))
  await db.products.bulkPut(rows)
}

export async function cacheCustomersLocally(customers: Array<{
  id: string; name: string; phone?: string | null; email?: string | null
  state: string; gstin?: string | null; address?: string | null
}>): Promise<void> {
  const db = getDB()
  const now = Date.now()
  const rows: CachedCustomer[] = customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    state: c.state,
    gstin: c.gstin ?? null,
    address: c.address ?? null,
    cached_at: now,
  }))
  await db.customers.bulkPut(rows)
}

// ─── Offline invoice queue ─────────────────────────────────────────────────

export async function queueOfflineInvoice(payload: CreateInvoiceData): Promise<string> {
  const db = getDB()
  const temp_no = `OFFLINE-${Date.now()}`
  await db.offline_invoices.add({
    temp_no,
    payload,
    status: 'pending',
    error_msg: null,
    created_at: Date.now(),
    synced_at: null,
  })
  return temp_no
}

export async function getPendingOfflineInvoices() {
  const db = getDB()
  return db.offline_invoices.where('status').anyOf(['pending', 'error']).toArray()
}

export async function getPendingCount(): Promise<number> {
  const db = getDB()
  return db.offline_invoices.where('status').anyOf(['pending', 'error']).count()
}

// ─── Sync pending invoices to Supabase ────────────────────────────────────

export async function syncOfflineInvoices(): Promise<{ synced: number; failed: number }> {
  const db = getDB()
  const pending = await getPendingOfflineInvoices()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const { createInvoice } = await import('@/actions/invoices')
  let synced = 0
  let failed = 0

  for (const inv of pending) {
    if (!inv.id) continue
    await db.offline_invoices.update(inv.id, { status: 'syncing' })
    try {
      await createInvoice(inv.payload)
      await db.offline_invoices.update(inv.id, {
        status: 'synced',
        synced_at: Date.now(),
      })
      synced++
    } catch (err) {
      await db.offline_invoices.update(inv.id, {
        status: 'error',
        error_msg: err instanceof Error ? err.message : 'Sync failed',
      })
      failed++
    }
  }

  return { synced, failed }
}

// ─── Offline product search ────────────────────────────────────────────────

export async function searchCachedProducts(query: string, limit = 10): Promise<CachedProduct[]> {
  const db = getDB()
  const q = query.trim().toLowerCase()
  if (!q) return []

  const all = await db.products
    .where('status').equals('active')
    .toArray()

  return all
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    )
    .slice(0, limit)
}

export async function getCachedCustomers(query?: string): Promise<CachedCustomer[]> {
  const db = getDB()
  if (!query?.trim()) {
    return db.customers.limit(100).toArray()
  }
  const q = query.trim().toLowerCase()
  const all = await db.customers.toArray()
  return all.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.phone && c.phone.includes(q))
  ).slice(0, 20)
}
