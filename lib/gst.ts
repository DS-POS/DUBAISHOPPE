export interface GSTLineItem {
  rate: number
  quantity: number
  discount: number
  gst_rate: number
}

export interface GSTCalculated {
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  total: number
}

export function calculateLineGST(item: GSTLineItem, customerState: string): GSTCalculated {
  const gross = item.rate * item.quantity
  const taxable_amount = gross - item.discount
  const isIntraState = customerState.toLowerCase() === 'telangana'
  const gst_amount = taxable_amount * (item.gst_rate / 100)

  let cgst = 0, sgst = 0, igst = 0
  if (isIntraState) {
    cgst = gst_amount / 2
    sgst = gst_amount / 2
  } else {
    igst = gst_amount
  }

  return {
    taxable_amount: round2(taxable_amount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    total_gst: round2(gst_amount),
    total: round2(taxable_amount + gst_amount),
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
