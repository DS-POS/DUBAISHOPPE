export interface GSTLineItem {
  rate: number
  quantity: number
  discount: number
  gst_rate: number
  is_taxable?: boolean  // undefined treated as true (backwards compat)
}

export interface GSTCalculated {
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  total: number
}

// rate is the per-unit price INCLUDING GST (what customer pays).
// Back-calculate taxable value: taxable = (rate × qty - discount) / (1 + gst_rate/100)
export function calculateLineGST(item: GSTLineItem, customerState: string): GSTCalculated {
  const gross = item.rate * item.quantity  // incl-GST gross
  const net = gross - item.discount        // incl-GST net after discount

  if (item.is_taxable === false) {
    return {
      taxable_amount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total_gst: 0,
      total: round2(net),
    }
  }

  const isIntraState = customerState.toLowerCase() === 'telangana'
  // Back-calculate taxable base from incl-GST price
  const divisor = 1 + item.gst_rate / 100
  const taxable_amount = net / divisor
  const gst_amount = net - taxable_amount
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
    total: round2(net),
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
