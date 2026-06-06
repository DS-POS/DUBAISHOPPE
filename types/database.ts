export type UserRole = 'admin' | 'staff'
export type ProductStatus = 'active' | 'inactive'
export type SerialStatus = 'available' | 'sold' | 'damaged' | 'returned'
export type StockChangeType = 'stock_in' | 'sale' | 'adjustment' | 'return'
export type StockAdjustmentType = 'damage' | 'return' | 'correction' | 'write_off' | 'found'
export type ReturnRefundMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'store_credit' | 'no_refund' | 'balance_adjustment'
export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'
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

export interface Profile {
  id: string
  name: string
  email: string | null
  role: UserRole
  is_active: boolean
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
  is_taxable: boolean
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

export interface StockAdjustment {
  id: string
  product_id: string
  adjustment_type: StockAdjustmentType
  quantity: number
  notes: string | null
  created_by: string | null
  created_at: string
  products?: Pick<Product, 'id' | 'name' | 'sku' | 'current_stock'>
}

export interface SalesReturnItem {
  id: string
  return_id: string
  invoice_item_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  serial_number: string | null
  quantity_returned: number
  rate: number
  discount: number
  gst_rate: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface SalesReturn {
  id: string
  return_no: string
  invoice_id: string
  reason: string
  refund_method: ReturnRefundMethod
  total_refund: number
  notes: string | null
  created_by: string | null
  created_at: string
  invoices?: Pick<Invoice, 'id' | 'invoice_no' | 'grand_total'>
  sales_return_items?: SalesReturnItem[]
}

export interface PurchaseOrderItem {
  id: string
  po_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity_ordered: number
  unit_cost: number
  total_cost: number
}

export interface PurchaseOrder {
  id: string
  po_no: string
  supplier_id: string | null
  supplier_name: string | null
  status: POStatus
  expected_date: string | null
  notes: string | null
  total_amount: number
  created_by: string | null
  created_at: string
  updated_at: string
  suppliers?: Pick<Supplier, 'id' | 'name' | 'phone' | 'email'>
  purchase_order_items?: PurchaseOrderItem[]
}

export interface SupplierInvoice {
  id: string
  purchase_invoice_no: string | null
  supplier_name: string | null
  supplier_gstin: string | null
  purchase_date: string
  total_amount: number
  payment_status: SupplierPaymentStatus
  supplier_id: string | null
  due_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  supplier_payments?: SupplierPayment[]
  stock_in?: StockIn[]
  suppliers?: Pick<Supplier, 'id' | 'name' | 'phone' | 'gstin'>
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
  business_name: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  state: string
  credit_limit: number
  credit_days: number
  created_at: string
}

export interface Invoice {
  id: string
  invoice_no: string
  invoice_type: 'tax_invoice' | 'bill_of_supply'
  order_group_id: string | null
  customer_id: string | null
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  amount_paid: number
  total_returns: number
  payment_method: PaymentMethod | null
  status: InvoiceStatus
  created_by: string | null
  created_at: string
  customers?: Customer
  invoice_items?: InvoiceItem[]
  invoice_payments?: InvoicePayment[]
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod | null
  payment_reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  business_name: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  state: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
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
  is_taxable: boolean
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
  quotation_date: string | null
  status: QuotationStatus
  converted_invoice_id: string | null
  notes: string | null
  selected_bank_index: number | null
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

export type ExpensePaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque'

export interface ExpenseCategory {
  id: string
  name: string
  created_at: string
}

export interface Expense {
  id: string
  date: string
  category_id: string | null
  amount: number
  description: string
  payment_method: ExpensePaymentMethod
  reference_no: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  expense_categories?: ExpenseCategory
}

export type StoreLoanDirection = 'lent_out' | 'borrowed_in'
export type StoreLoanStatus = 'pending' | 'returned' | 'converted_to_invoice'

export interface StoreLoan {
  id: string
  direction: StoreLoanDirection
  store_name: string
  person_name: string
  product_name: string
  quantity: number
  price: number | null
  loan_date: string
  expected_return_date: string | null
  returned_date: string | null
  status: StoreLoanStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
