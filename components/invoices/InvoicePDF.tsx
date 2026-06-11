import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { STORE } from '@/lib/store-constants'
import type { Invoice, InvoiceItem, Customer, SalesReturn, SalesReturnItem } from '@/types/database'
import { round2 } from '@/lib/gst'
import path from 'path'
import fs from 'fs'

Font.register({
  family: 'SegoeUI',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Italic.ttf'), fontStyle: 'italic' },
  ],
})

const _logoPath = path.join(process.cwd(), 'public', 'DUBAI LOGO BR.png')
const LOGO_SRC = `data:image/png;base64,${fs.readFileSync(_logoPath).toString('base64')}`
const GREEN = '#4B5563'
const DARK_GREEN = '#111827'

function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function two(n: number): string {
    if (n < 20) return ones[n]
    return (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')).trim()
  }
  function three(n: number): string {
    if (n === 0) return ''
    if (n < 100) return two(n)
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '')
  }
  const r = Math.floor(amount)
  const p = Math.round((amount - r) * 100)
  if (r === 0 && p === 0) return 'Zero Rupees Only'
  let res = ''
  if (r >= 10000000) res += three(Math.floor(r / 10000000)) + ' Crore '
  if (r % 10000000 >= 100000) res += two(Math.floor((r % 10000000) / 100000)) + ' Lakh '
  if (r % 100000 >= 1000) res += two(Math.floor((r % 100000) / 1000)) + ' Thousand '
  if (r % 1000 > 0) res += three(r % 1000) + ' '
  res = res.trim() + ' Rupees'
  if (p > 0) res += ' and ' + two(p) + ' Paise'
  return res + ' Only'
}

const s = StyleSheet.create({
  page: { fontFamily: 'SegoeUI', fontSize: 9, color: '#1e293b', paddingHorizontal: 32, paddingTop: 0, paddingBottom: 14 },
  borderTop: { height: 6, backgroundColor: '#D1D5DB', marginBottom: 18 },
  borderBottom: {
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1.5,
    borderTopColor: '#D1D5DB',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderBottomText: { fontSize: 7.5, color: '#111827', fontFamily: 'SegoeUI', fontWeight: 'bold' },
  borderBottomSep: { fontSize: 7.5, color: '#1e293b', marginHorizontal: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  logoImg: { width: 110, height: 110 },
  logoClip: { width: 110, height: 72, overflow: 'hidden', backgroundColor: '#ffffff' },
  headerDividerV: { width: 1, backgroundColor: '#D1D5DB', marginHorizontal: 12, alignSelf: 'stretch' },
  storeName: { fontSize: 14, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK_GREEN },
  storeTagline: { fontSize: 7, color: '#64748b', marginTop: 1, marginBottom: 4, fontFamily: 'SegoeUI', fontWeight: 'bold' },
  storeDetail: { fontSize: 8, color: '#374151', marginTop: 2 },
  invoiceTitle: { fontSize: 20, fontFamily: 'SegoeUI', fontWeight: 'bold', color: GREEN, textAlign: 'right' },
  invoiceDetail: { fontSize: 8, color: '#64748b', textAlign: 'right', marginTop: 2 },
  invoiceHighlightBox: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, marginTop: 5, alignItems: 'flex-end' },
  invoiceHighlightLabel: { fontSize: 6.5, color: '#4B5563', fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  invoiceHighlightValue: { fontSize: 12, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a', textAlign: 'right', marginTop: 1 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  greenDivider: { borderBottomWidth: 1, borderBottomColor: '#D1D5DB', marginVertical: 10 },
  billRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  billBox: { flex: 1 },
  billLabel: { fontSize: 7, color: GREEN, fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  billValue: { fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a' },
  billSub: { fontSize: 8, color: '#475569', marginTop: 2 },
  gstnBadge: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginTop: 4, alignSelf: 'flex-start' },
  gstnText: { fontSize: 7, color: DARK_GREEN, fontFamily: 'SegoeUI', fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#D1D5DB', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCell: { fontSize: 8 },
  col_no: { width: 20 },
  col_desc: { flex: 1, paddingRight: 8 },
  col_hsn: { width: 52 },
  col_qty: { width: 28, textAlign: 'right' },
  col_rate: { width: 52, textAlign: 'right' },
  col_disc: { width: 40, textAlign: 'right' },
  col_taxable: { width: 55, textAlign: 'right' },
  col_gst: { width: 30, textAlign: 'right' },
  col_cgst: { width: 44, textAlign: 'right' },
  col_sgst: { width: 44, textAlign: 'right' },
  col_igst: { width: 44, textAlign: 'right' },
  col_total: { width: 56, textAlign: 'right' },
  totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalsBox: { width: 210 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: '#64748b' },
  totalValue: { fontSize: 8, color: '#0f172a', fontFamily: 'SegoeUI', fontWeight: 'bold' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: '#E5E7EB', borderRadius: 4,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4,
  },
  grandTotalLabel: { fontSize: 10, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK_GREEN },
  grandTotalValue: { fontSize: 10, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a' },
  paidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, marginTop: 2 },
  amountWordsBox: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3, marginTop: 6 },
  amountWordsLabel: { fontSize: 6.5, color: '#4B5563', fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  amountWordsText: { fontSize: 8, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a' },
  dueRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: '#fef2f2', borderRadius: 4,
    borderWidth: 1, borderColor: '#fecaca', marginTop: 4,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  footerText: { fontSize: 7, color: '#475569' },
  footerPageNum: { fontSize: 7, color: '#374151', fontFamily: 'SegoeUI', fontWeight: 'bold' },
  pageNumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4 },
  pageNumText: { fontSize: 6.5, color: '#94a3b8' },
  tcPage: { fontFamily: 'SegoeUI', fontSize: 9, color: '#1e293b', paddingHorizontal: 32, paddingTop: 0, paddingBottom: 0 },
  tcTitle: { fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#111827', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tcItem: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  tcNum: { fontSize: 7.5, color: '#374151', fontFamily: 'SegoeUI', fontWeight: 'bold', width: 14 },
  tcText: { fontSize: 7.5, color: '#374151', flex: 1, lineHeight: 1.5 },
  bosNote: { fontSize: 7.5, color: '#92400e', fontFamily: 'SegoeUI', fontWeight: 'bold', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, marginBottom: 8, alignSelf: 'flex-start' },
})

function InvoiceSinglePage({ invoice, items, customer, returns, linkedSibling, invoiceTerms }: {
  invoice: Invoice
  items: InvoiceItem[]
  customer: Customer | null
  returns?: (SalesReturn & { sales_return_items: SalesReturnItem[] })[]
  linkedSibling?: Invoice
  invoiceTerms?: string[]
}) {
  const isBOS = invoice.invoice_type === 'bill_of_supply'
  const isIGST = (invoice.igst ?? 0) > 0
  const isIntraState = !isIGST
  const taxableAmount = invoice.taxable_amount ?? 0
  const balanceDue = round2(invoice.grand_total - (invoice.total_returns ?? 0) - invoice.amount_paid)
  const invoiceTypeLabel = isBOS ? 'BILL OF SUPPLY' : 'TAX INVOICE'
  const totalReturned = invoice.total_returns ?? 0
  const hasReturns = totalReturned > 0
  const netPayable = round2(invoice.grand_total - totalReturned)
  const returnedQtyMap = new Map<string, number>()
  if (returns) {
    for (const ret of returns) {
      for (const ri of (ret.sales_return_items ?? [])) {
        returnedQtyMap.set(ri.invoice_item_id, (returnedQtyMap.get(ri.invoice_item_id) ?? 0) + ri.quantity_returned)
      }
    }
  }

  return (
    <Page size="A4" style={s.page}>

      {/* Top border */}
      <View style={[s.borderTop, isBOS ? { backgroundColor: '#94a3b8' } : {}]} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoBlock}>
          <View style={s.logoClip}>
            <Image src={LOGO_SRC} style={s.logoImg} />
          </View>
          <View style={s.headerDividerV} />
          <View>
            <Text style={s.storeName}>{STORE.name}</Text>
            <Text style={s.storeTagline}>GEAR FOR PHOTO, VIDEO & CREATIVE PROFESSIONALS</Text>
            <Text style={s.storeDetail}>{STORE.address}</Text>
            <Text style={s.storeDetail}>{STORE.city}</Text>
            <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
            <Text style={s.storeDetail}>Email: {STORE.email}</Text>
            {!isBOS && (
              <View style={s.gstnBadge}>
                <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.invoiceTitle}>{invoiceTypeLabel}{hasReturns ? ' (REVISED)' : ''}</Text>
          <View style={s.invoiceHighlightBox}>
            <Text style={s.invoiceHighlightLabel}>Invoice No</Text>
            <Text style={s.invoiceHighlightValue}>{invoice.invoice_no}</Text>
          </View>
          <View style={[s.invoiceHighlightBox, { marginTop: 3 }]}>
            <Text style={s.invoiceHighlightLabel}>Date</Text>
            <Text style={[s.invoiceHighlightValue, { fontSize: 10 }]}>{new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
          </View>
          <Text style={[s.invoiceDetail, { marginTop: 3 }]}>Payment: {invoice.payment_method?.toUpperCase()}</Text>
          {invoice.payment_method === 'insurance' && invoice.insurance_company && (
            <Text style={[s.invoiceDetail, { marginTop: 2 }]}>Insurer: {invoice.insurance_company}</Text>
          )}
          {invoice.payment_method === 'insurance' && invoice.insurance_claim_no && (
            <Text style={[s.invoiceDetail, { marginTop: 1 }]}>Claim No: {invoice.insurance_claim_no}</Text>
          )}
        </View>
      </View>

      <View style={s.greenDivider} />

      {/* Bill To */}
      <View style={s.billRow}>
        <View style={s.billBox}>
          <Text style={s.billLabel}>Bill To</Text>
          <Text style={s.billValue}>{customer ? customer.name : 'Walk-in Customer'}</Text>
          {customer?.business_name && <Text style={s.billSub}>{customer.business_name}</Text>}
          {customer?.phone && <Text style={s.billSub}>Ph: {customer.phone}</Text>}
          {customer?.email && <Text style={s.billSub}>Email: {customer.email}</Text>}
          {customer?.address && <Text style={s.billSub}>{customer.address}</Text>}
          {customer?.gstin && <View style={s.gstnBadge}><Text style={s.gstnText}>GSTIN: {customer.gstin}</Text></View>}
          {customer?.state && <Text style={[s.billSub, { marginTop: 2 }]}>State: {customer.state}</Text>}
        </View>
      </View>

      <View style={s.divider} />

      {isBOS ? (
        /* Bill of Supply — simplified table, no GST columns */
        <>
          <View style={[s.tableHeader, { backgroundColor: '#475569' }]}>
            <Text style={[s.tableHeaderCell, s.col_no]}>#</Text>
            <Text style={[s.tableHeaderCell, s.col_desc]}>Description</Text>
            <Text style={[s.tableHeaderCell, s.col_hsn]}>HSN</Text>
            <Text style={[s.tableHeaderCell, s.col_qty]}>Qty</Text>
            <Text style={[s.tableHeaderCell, s.col_rate]}>Rate</Text>
            <Text style={[s.tableHeaderCell, s.col_disc]}>Disc.</Text>
            <Text style={[s.tableHeaderCell, s.col_total]}>Total</Text>
          </View>
          {items.map((item, i) => {
            const retQty = returnedQtyMap.get(item.id) ?? 0
            const netQty = Math.max(0, item.quantity - retQty)
            const isFullyReturned = retQty >= item.quantity
            const netTotal = item.quantity > 0 ? round2(item.total * netQty / item.quantity) : 0
            return (
              <View key={item.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}, isFullyReturned ? { backgroundColor: '#fef2f2' } : {}]}>
                <Text style={[s.tableCell, s.col_no]}>{i + 1}</Text>
                <View style={s.col_desc}>
                  <Text style={[s.tableCell, { fontFamily: 'SegoeUI', fontWeight: 'bold', color: isFullyReturned ? '#dc2626' : '#0f172a', textDecoration: isFullyReturned ? 'line-through' : 'none' }]}>{item.product_name}</Text>
                  {item.sku && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>{item.sku}</Text>}
                  {item.serial_number && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>S/N: {item.serial_number}</Text>}
                  {retQty > 0 && <Text style={{ fontSize: 6.5, color: '#dc2626', fontFamily: 'SegoeUI' }}>{isFullyReturned ? 'RETURNED' : `${retQty} returned`}</Text>}
                </View>
                <Text style={[s.tableCell, s.col_hsn]}>{item.hsn_code ?? '—'}</Text>
                <Text style={[s.tableCell, s.col_qty, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '0' : `${netQty}`}</Text>
                <Text style={[s.tableCell, s.col_rate]}>₹{round2(item.rate).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_disc]}>₹{round2(item.discount).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_total, { fontFamily: 'SegoeUI', fontWeight: 'bold', color: isFullyReturned ? '#dc2626' : '#0f172a' }]}>{isFullyReturned ? '—' : `₹${netTotal.toFixed(2)}`}</Text>
              </View>
            )
          })}
        </>
      ) : (
        /* Tax Invoice — full GST table */
        <>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.col_no]}>#</Text>
            <Text style={[s.tableHeaderCell, s.col_desc]}>Description</Text>
            <Text style={[s.tableHeaderCell, s.col_hsn]}>HSN</Text>
            <Text style={[s.tableHeaderCell, s.col_qty]}>Qty</Text>
            <Text style={[s.tableHeaderCell, s.col_rate]}>Rate</Text>
            <Text style={[s.tableHeaderCell, s.col_disc]}>Disc.</Text>
            <Text style={[s.tableHeaderCell, s.col_taxable]}>Taxable</Text>
            <Text style={[s.tableHeaderCell, s.col_gst]}>GST%</Text>
            {isIntraState ? (
              <>
                <Text style={[s.tableHeaderCell, s.col_cgst]}>CGST</Text>
                <Text style={[s.tableHeaderCell, s.col_sgst]}>SGST</Text>
              </>
            ) : (
              <Text style={[s.tableHeaderCell, s.col_igst]}>IGST</Text>
            )}
            <Text style={[s.tableHeaderCell, s.col_total]}>Total</Text>
          </View>
          {items.map((item, i) => {
            const retQty = returnedQtyMap.get(item.id) ?? 0
            const netQty = Math.max(0, item.quantity - retQty)
            const isFullyReturned = retQty >= item.quantity
            const ratio = item.quantity > 0 ? netQty / item.quantity : 0
            const netTaxable = round2(item.taxable_amount * ratio)
            const netCgst = round2(item.cgst * ratio)
            const netSgst = round2(item.sgst * ratio)
            const netIgst = round2(item.igst * ratio)
            const netTotal = round2(item.total * ratio)
            return (
              <View key={item.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}, isFullyReturned ? { backgroundColor: '#fef2f2' } : {}]}>
                <Text style={[s.tableCell, s.col_no]}>{i + 1}</Text>
                <View style={s.col_desc}>
                  <Text style={[s.tableCell, { fontFamily: 'SegoeUI', fontWeight: 'bold', color: isFullyReturned ? '#dc2626' : '#0f172a', textDecoration: isFullyReturned ? 'line-through' : 'none' }]}>{item.product_name}</Text>
                  {item.sku && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>{item.sku}</Text>}
                  {item.serial_number && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>S/N: {item.serial_number}</Text>}
                  {retQty > 0 && <Text style={{ fontSize: 6.5, color: '#dc2626', fontFamily: 'SegoeUI' }}>{isFullyReturned ? 'RETURNED' : `${retQty} returned`}</Text>}
                </View>
                <Text style={[s.tableCell, s.col_hsn]}>{item.hsn_code ?? '—'}</Text>
                <Text style={[s.tableCell, s.col_qty, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '0' : `${netQty}`}</Text>
                <Text style={[s.tableCell, s.col_rate]}>₹{round2(item.rate).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_disc]}>₹{round2(item.discount).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_taxable, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '—' : `₹${netTaxable.toFixed(2)}`}</Text>
                <Text style={[s.tableCell, s.col_gst]}>{item.gst_rate}%</Text>
                {isIntraState ? (
                  <>
                    <Text style={[s.tableCell, s.col_cgst, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '—' : `₹${netCgst.toFixed(2)}`}</Text>
                    <Text style={[s.tableCell, s.col_sgst, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '—' : `₹${netSgst.toFixed(2)}`}</Text>
                  </>
                ) : (
                  <Text style={[s.tableCell, s.col_igst, isFullyReturned ? { color: '#dc2626' } : {}]}>{isFullyReturned ? '—' : `₹${netIgst.toFixed(2)}`}</Text>
                )}
                <Text style={[s.tableCell, s.col_total, { fontFamily: 'SegoeUI', fontWeight: 'bold', color: isFullyReturned ? '#dc2626' : '#0f172a' }]}>{isFullyReturned ? '—' : `₹${netTotal.toFixed(2)}`}</Text>
              </View>
            )
          })}
        </>
      )}

      {/* Totals */}
      <View style={s.totalsSection}>
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>₹{round2(invoice.subtotal).toFixed(2)}</Text>
          </View>
          {invoice.discount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Discount</Text>
              <Text style={[s.totalValue, { color: GREEN }]}>-₹{round2(invoice.discount).toFixed(2)}</Text>
            </View>
          )}
          {!isBOS && taxableAmount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Taxable Amount</Text>
              <Text style={s.totalValue}>₹{round2(taxableAmount).toFixed(2)}</Text>
            </View>
          )}
          {!isBOS && taxableAmount > 0 && (isIGST ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>IGST</Text>
              <Text style={s.totalValue}>₹{round2(invoice.igst ?? 0).toFixed(2)}</Text>
            </View>
          ) : (
            <>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>CGST</Text>
                <Text style={s.totalValue}>₹{round2(invoice.cgst ?? 0).toFixed(2)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>SGST</Text>
                <Text style={s.totalValue}>₹{round2(invoice.sgst ?? 0).toFixed(2)}</Text>
              </View>
            </>
          ))}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>Grand Total</Text>
            <Text style={s.grandTotalValue}>₹{round2(invoice.grand_total).toFixed(2)}</Text>
          </View>
          {hasReturns && (
            <>
              <View style={[s.totalRow, { marginTop: 2 }]}>
                <Text style={[s.totalLabel, { color: '#dc2626' }]}>Returns (Credit)</Text>
                <Text style={[s.totalValue, { color: '#dc2626' }]}>-₹{round2(totalReturned).toFixed(2)}</Text>
              </View>
              <View style={[s.grandTotalRow, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={[s.grandTotalLabel, { color: '#15803d' }]}>Net Payable</Text>
                <Text style={[s.grandTotalValue, { color: '#15803d' }]}>₹{netPayable.toFixed(2)}</Text>
              </View>
            </>
          )}
          <View style={s.amountWordsBox}>
            <Text style={s.amountWordsLabel}>Amount in Words</Text>
            <Text style={s.amountWordsText}>{amountInWords(hasReturns ? netPayable : round2(invoice.grand_total))}</Text>
          </View>
          {(() => {
            // For split orders, only show "balance below" note when balance is still outstanding
            if (linkedSibling) {
              const sibRet2 = linkedSibling.total_returns ?? 0
              const grpTotal2 = round2(invoice.grand_total + linkedSibling.grand_total)
              const grpPaid2 = round2(invoice.amount_paid + linkedSibling.amount_paid)
              const grpRet2 = round2(totalReturned + sibRet2)
              const grpBal2 = round2(grpTotal2 - grpPaid2 - grpRet2)
              if (grpBal2 !== 0) {
                return (
                  <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f0fdfa', borderRadius: 3, borderWidth: 0.5, borderColor: '#99f6e4' }}>
                    <Text style={{ fontSize: 7, color: '#0f766e', fontFamily: 'SegoeUI', fontWeight: 'bold' }}>Payment & balance details in Order Balance Summary below</Text>
                  </View>
                )
              }
            }
            // For non-split or settled split orders — show normal paid / balance rows
            return (
              <>
                <View style={s.paidRow}>
                  <Text style={[s.totalLabel]}>Amount Paid</Text>
                  <Text style={s.totalValue}>₹{round2(invoice.amount_paid).toFixed(2)}</Text>
                </View>
                {balanceDue > 0 && (
                  <View style={s.dueRow}>
                    <Text style={[s.grandTotalLabel, { color: '#dc2626' }]}>Balance Due</Text>
                    <Text style={[s.grandTotalValue, { color: '#dc2626' }]}>₹{balanceDue.toFixed(2)}</Text>
                  </View>
                )}
              </>
            )
          })()}
          {linkedSibling && (() => {
            const sibRet = linkedSibling.total_returns ?? 0
            const grpTotal = round2(invoice.grand_total + linkedSibling.grand_total)
            const grpPaid = round2(invoice.amount_paid + linkedSibling.amount_paid)
            const grpRet = round2(totalReturned + sibRet)
            const grpBal = round2(grpTotal - grpPaid - grpRet)
            // Hide when fully settled — no outstanding balance
            if (grpBal === 0) return null
            const tiNo = invoice.invoice_type === 'tax_invoice' ? invoice.invoice_no : linkedSibling.invoice_no
            const bosNo = invoice.invoice_type === 'bill_of_supply' ? invoice.invoice_no : linkedSibling.invoice_no
            const tiAmt = round2(invoice.invoice_type === 'tax_invoice' ? invoice.grand_total : linkedSibling.grand_total)
            const bosAmt = round2(invoice.invoice_type === 'bill_of_supply' ? invoice.grand_total : linkedSibling.grand_total)
            const balColor = grpBal > 0 ? '#dc2626' : '#15803d'
            const balLabel = grpBal > 0 ? 'Order Balance Due' : 'Order Refund Due'
            const balDisplay = `₹${Math.abs(grpBal).toFixed(2)}`
            return (
              <View style={[s.amountWordsBox, { marginTop: 10, backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
                <Text style={[s.amountWordsLabel, { color: '#0f766e' }]}>ORDER BALANCE SUMMARY</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>Tax Invoice ({tiNo})</Text>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>₹{tiAmt.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>Bill of Supply ({bosNo})</Text>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>₹{bosAmt.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 3 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a' }}>Order Total</Text>
                  <Text style={{ fontSize: 8, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#0f172a' }}>₹{grpTotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>Total Paid</Text>
                  <Text style={{ fontSize: 7.5, color: '#374151' }}>₹{grpPaid.toFixed(2)}</Text>
                </View>
                {grpRet > 0 && (
                  <>
                    {round2(grpTotal - grpPaid) > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={{ fontSize: 7.5, color: '#9ca3af', textDecoration: 'line-through' }}>Pending Before Returns</Text>
                        <Text style={{ fontSize: 7.5, color: '#9ca3af', textDecoration: 'line-through' }}>₹{round2(grpTotal - grpPaid).toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ fontSize: 7.5, color: '#dc2626' }}>Returns Credit</Text>
                      <Text style={{ fontSize: 7.5, color: '#dc2626' }}>-₹{grpRet.toFixed(2)}</Text>
                    </View>
                  </>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 3 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: balColor }}>{balLabel}</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: balColor }}>{balDisplay}</Text>
                </View>
              </View>
            )
          })()}
        </View>
      </View>

      {/* Terms & Conditions — Tax Invoice only, never break mid-list */}
      {!isBOS && invoiceTerms && invoiceTerms.length > 0 && (
        <View wrap={false} style={{ marginTop: 10 }}>
          <View style={s.greenDivider} />
          <Text style={s.tcTitle}>Terms &amp; Conditions</Text>
          {invoiceTerms.map((term, i) => (
            <View key={i} style={s.tcItem}>
              <Text style={s.tcNum}>{i + 1}.</Text>
              <Text style={s.tcText}>{term}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Page number — fixed tiny element on every page, hidden on single-page docs */}
      <Text
        fixed
        style={{ position: 'absolute', bottom: 20, right: 32, fontSize: 7.5, color: '#111827', fontFamily: 'SegoeUI', fontWeight: 'bold' }}
        render={({ pageNumber, totalPages }) => totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ''}
      />

      {/* Footer — normal flow, appears right after content with no blank gap */}
      <View style={[s.footer, { marginTop: 10 }]}>
        <Text style={s.footerText}>This is a computer-generated invoice. No signature required.</Text>
        <Text style={s.footerText}>{STORE.name} · GSTIN: {STORE.gstin} · {STORE.phone}</Text>
      </View>

      {/* Bottom border — normal flow */}
      <View style={[s.borderBottom, { marginTop: 0 }]}>
        <Text style={s.borderBottomText}>Dubaishoppe_hyd@yahoo.com</Text>
        <Text style={s.borderBottomSep}>|</Text>
        <Text style={s.borderBottomText}>+91 9885878645 / +91 9866141485</Text>
        <Text style={s.borderBottomSep}>|</Text>
        <Text style={s.borderBottomText}>DUBAI SHOPPE — GSTIN: 36ALBPM0907C1ZO</Text>
      </View>

    </Page>
  )
}


interface InvoicePDFProps {
  invoice: Invoice
  items: InvoiceItem[]
  customer: Customer | null
  linkedInvoice?: (Invoice & { invoice_items: InvoiceItem[] }) | null
  returns?: (SalesReturn & { sales_return_items: SalesReturnItem[] })[]
  invoiceTerms?: string[]
}

export function InvoicePDF({ invoice, items, customer, linkedInvoice, returns, invoiceTerms }: InvoicePDFProps) {
  const hasTerms = invoiceTerms && invoiceTerms.length > 0
  return (
    <Document>
      <InvoiceSinglePage invoice={invoice} items={items} customer={customer} returns={returns} linkedSibling={linkedInvoice ?? undefined} invoiceTerms={hasTerms ? invoiceTerms : undefined} />
      {linkedInvoice && (
        <InvoiceSinglePage
          invoice={linkedInvoice}
          items={linkedInvoice.invoice_items ?? []}
          customer={customer}
          linkedSibling={invoice}
          invoiceTerms={hasTerms ? invoiceTerms : undefined}
        />
      )}
    </Document>
  )
}
