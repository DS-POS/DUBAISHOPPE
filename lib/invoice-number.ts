export function formatInvoiceNo(counter: number): string {
  return `INV-${String(counter).padStart(6, '0')}`
}

export function formatQuotationNo(counter: number): string {
  return `QUO-${String(counter).padStart(6, '0')}`
}

export function formatReturnNo(counter: number): string {
  return `RET-${String(counter).padStart(6, '0')}`
}

export function formatPONo(counter: number): string {
  return `PO-${String(counter).padStart(6, '0')}`
}
