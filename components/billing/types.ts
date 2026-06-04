import { calculateLineGST } from '@/lib/gst'
import type { Product } from '@/types/database'

export interface CartItem {
  _id: string
  product: Product
  quantity: number
  rate: number
  discount_mode: 'percent' | 'flat'
  discount_raw: number
  discount: number
  serial_number: string | null
  is_taxable: boolean
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  total: number
}

export function recalcItem(
  item: Omit<CartItem, 'taxable_amount' | 'cgst' | 'sgst' | 'igst' | 'total_gst' | 'total' | 'discount'>,
  customerState: string
): CartItem {
  const discount =
    item.discount_mode === 'percent'
      ? Number((item.rate * item.quantity * item.discount_raw / 100).toFixed(2))
      : item.discount_raw
  const gst = calculateLineGST(
    {
      rate: item.rate,
      quantity: item.quantity,
      discount,
      gst_rate: item.product.gst_rate,
      is_taxable: item.is_taxable,
    },
    customerState
  )
  return { ...item, discount, ...gst }
}

export interface NonTaxableLineItem {
  name: string
  qty: number
  total: number
}

export function cartTotals(items: CartItem[]) {
  const taxable = items.filter(i => i.is_taxable)
  const nonTaxable = items.filter(i => !i.is_taxable)
  return {
    subtotal: items.reduce((s, i) => s + i.rate * i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discount, 0),
    taxable_amount: taxable.reduce((s, i) => s + i.taxable_amount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    total_gst: items.reduce((s, i) => s + i.total_gst, 0),
    grand_total: items.reduce((s, i) => s + i.total, 0),
    non_taxable_items: nonTaxable.map(i => ({
      name: i.product.name,
      qty: i.quantity,
      total: i.total,
    })),
  }
}
