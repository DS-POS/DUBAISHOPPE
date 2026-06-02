import { calculateLineGST } from '@/lib/gst'
import type { Product } from '@/types/database'

export interface CartItem {
  _id: string
  product: Product
  quantity: number
  rate: number
  discount: number
  serial_number: string | null
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  total: number
}

export function recalcItem(item: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total'>, customerState: string): CartItem {
  const gst = calculateLineGST(
    { rate: item.rate, quantity: item.quantity, discount: item.discount, gst_rate: item.product.gst_rate },
    customerState
  )
  return { ...item, ...gst }
}

export function cartTotals(items: CartItem[]) {
  return {
    subtotal: items.reduce((s, i) => s + i.rate * i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discount, 0),
    taxable_amount: items.reduce((s, i) => s + i.taxable_amount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    total_gst: items.reduce((s, i) => s + i.total_gst, 0),
    grand_total: items.reduce((s, i) => s + i.total, 0),
  }
}
