import Dexie, { type Table } from 'dexie'
import type { CreateInvoiceData } from '@/actions/invoices'

export interface CachedProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: number
  cost_price: number
  gst_rate: number
  hsn_code: string | null
  current_stock: number
  requires_serial: boolean
  track_serial: boolean
  brand: string | null
  status: string
  category_id: string | null
  cached_at: number
}

export interface CachedCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  state: string
  gstin: string | null
  address: string | null
  cached_at: number
}

export interface OfflineInvoice {
  id?: number
  temp_no: string
  payload: CreateInvoiceData
  status: 'pending' | 'syncing' | 'synced' | 'error'
  error_msg: string | null
  created_at: number
  synced_at: number | null
}

class DSPOSDatabase extends Dexie {
  products!: Table<CachedProduct>
  customers!: Table<CachedCustomer>
  offline_invoices!: Table<OfflineInvoice>

  constructor() {
    super('ds_pos_v1')
    this.version(1).stores({
      products: 'id, sku, barcode, status, cached_at',
      customers: 'id, phone, cached_at',
      offline_invoices: '++id, status, created_at',
    })
  }
}

// Singleton — safe to import anywhere client-side
let _db: DSPOSDatabase | null = null

export function getDB(): DSPOSDatabase {
  if (!_db) _db = new DSPOSDatabase()
  return _db
}
