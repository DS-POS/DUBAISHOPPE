export type UserRole = 'admin' | 'staff'
export type ProductStatus = 'active' | 'inactive'
export type SerialStatus = 'available' | 'sold' | 'damaged' | 'returned'
export type StockChangeType = 'stock_in' | 'sale' | 'adjustment' | 'return'
export type InvoiceStatus = 'paid' | 'pending' | 'cancelled'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit'
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'expired' | 'rejected'
export type SupplierPaymentMethod = 'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs'
export type SupplierPaymentStatus = 'pending' | 'partial' | 'paid'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  category_id: string | null
  brand: string | null
  cost_price: number
  selling_price: number
  gst_rate: number
  hsn_code: string | null
  current_stock: number
  low_stock_alert: number
  serial_required: boolean
  image_url: string | null
  status: ProductStatus
  created_at: string
  updated_at: string
  categories?: Category
}

export interface ProductSerial {
  id: string
  product_id: string
  serial_number: string
  status: SerialStatus
  stock_in_id: string | null
  invoice_id: string | null
  created_at: string
}

export interface StockIn {
  id: string
  product_id: string
  quantity: number
  cost_price: number
  supplier_name: string | null
  supplier_gstin: string | null
  purchase_invoice_no: string | null
  purchase_date: string
  notes: string | null
  supplier_invoice_id: string | null
  created_by: string | null
  created_at: string
  products?: Product
}

export interface SupplierInvoice {
  id: string
  purchase_invoice_no: string | null
  supplier_name: string | null
  supplier_gstin: string | null
  purchase_date: string
  total_amount: number
  payment_status: SupplierPaymentStatus
  created_by: string | null
  created_at: string
  supplier_payments?: SupplierPayment[]
  stock_in?: StockIn[]
}

export interface SupplierPayment {
  id: string
  supplier_invoice_id: string
  amount: number
  payment_date: string
  payment_reference: string | null
  payment_method: SupplierPaymentMethod | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  state: string
  created_at: string
}

export interface Invoice {
  id: string
  invoice_no: string
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  payment_method: PaymentMethod | null
  status: InvoiceStatus
  created_by: string | null
  created_at: string
  customers?: Customer
  invoice_items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  hsn_code: string | null
  serial_number: string | null
  quantity: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface Quotation {
  id: string
  quotation_no: string
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  valid_until: string | null
  status: QuotationStatus
  converted_invoice_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  customers?: Customer
  quotation_items?: QuotationItem[]
}

export interface QuotationItem {
  id: string
  quotation_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  hsn_code: string | null
  quantity: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface Setting {
  id: string
  key: string
  value: string | null
  updated_at: string
}
