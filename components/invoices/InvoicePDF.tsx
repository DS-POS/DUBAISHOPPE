import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { STORE } from '@/lib/store-constants'
import type { Invoice, InvoiceItem, Customer } from '@/types/database'
import { round2 } from '@/lib/gst'
import path from 'path'
import fs from 'fs'

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
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', paddingHorizontal: 32, paddingTop: 0, paddingBottom: 0 },
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
  borderBottomText: { fontSize: 7.5, color: '#111827', fontFamily: 'Helvetica-Bold' },
  borderBottomSep: { fontSize: 7.5, color: '#1e293b', marginHorizontal: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  logoImg: { width: 90, height: 90, objectFit: 'contain' },
  headerDividerV: { width: 1, backgroundColor: '#D1D5DB', marginHorizontal: 12, alignSelf: 'stretch' },
  storeName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK_GREEN },
  storeTagline: { fontSize: 7, color: '#64748b', marginTop: 1 },
  storeDetail: { fontSize: 8, color: '#374151', marginTop: 2 },
  invoiceTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'right' },
  invoiceDetail: { fontSize: 8, color: '#64748b', textAlign: 'right', marginTop: 2 },
  invoiceHighlightBox: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, marginTop: 5, alignItems: 'flex-end' },
  invoiceHighlightLabel: { fontSize: 6.5, color: '#4B5563', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  invoiceHighlightValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right', marginTop: 1 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  greenDivider: { borderBottomWidth: 1, borderBottomColor: '#D1D5DB', marginVertical: 10 },
  billRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  billBox: { flex: 1 },
  billLabel: { fontSize: 7, color: GREEN, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 4 },
  billValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  billSub: { fontSize: 8, color: '#475569', marginTop: 2 },
  gstnBadge: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginTop: 4, alignSelf: 'flex-start' },
  gstnText: { fontSize: 7, color: DARK_GREEN, fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#D1D5DB', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCell: { fontSize: 8 },
  col_no: { width: 20 },
  col_desc: { flex: 1 },
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
  totalValue: { fontSize: 8, color: '#0f172a', fontFamily: 'Helvetica-Bold' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: '#E5E7EB', borderRadius: 4,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4,
  },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK_GREEN },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  paidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, marginTop: 2 },
  amountWordsBox: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3, marginTop: 6 },
  amountWordsLabel: { fontSize: 6.5, color: '#4B5563', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  amountWordsText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  dueRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: '#fef2f2', borderRadius: 4,
    borderWidth: 1, borderColor: '#fecaca', marginTop: 4,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

interface InvoicePDFProps {
  invoice: Invoice
  items: InvoiceItem[]
  customer: Customer | null
}

export function InvoicePDF({ invoice, items, customer }: InvoicePDFProps) {
  const taxableAmount = invoice.taxable_amount ?? 0
  const nonTaxableItems = (invoice.invoice_items ?? []).filter(i => !i.is_taxable)
  const isIGST = (invoice.igst ?? 0) > 0
  const isIntraState = !isIGST
  const balanceDue = round2(invoice.grand_total - invoice.amount_paid)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Top border */}
        <View style={s.borderTop} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBlock}>
            <Image src={LOGO_SRC} style={s.logoImg} />
            <View style={s.headerDividerV} />
            <View>
              <Text style={s.storeName}>{STORE.name}</Text>
              <Text style={s.storeTagline}>A Professional Camera Store</Text>
              <Text style={s.storeDetail}>{STORE.address}</Text>
              <Text style={s.storeDetail}>{STORE.city}</Text>
              <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
              <Text style={s.storeDetail}>Email: {STORE.email}</Text>
              <View style={s.gstnBadge}>
                <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invoiceTitle}>TAX INVOICE</Text>
            <View style={s.invoiceHighlightBox}>
              <Text style={s.invoiceHighlightLabel}>Invoice No</Text>
              <Text style={s.invoiceHighlightValue}>{invoice.invoice_no}</Text>
            </View>
            <View style={[s.invoiceHighlightBox, { marginTop: 3 }]}>
              <Text style={s.invoiceHighlightLabel}>Date</Text>
              <Text style={[s.invoiceHighlightValue, { fontSize: 10 }]}>{new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
            </View>
            <Text style={[s.invoiceDetail, { marginTop: 3 }]}>Payment: {invoice.payment_method?.toUpperCase()}</Text>
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

        {/* Table header */}
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

        {items.map((item, i) => (
          <View key={item.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}]}>
            <Text style={[s.tableCell, s.col_no]}>{i + 1}</Text>
            <View style={s.col_desc}>
              <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{item.product_name}</Text>
              {item.sku && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>{item.sku}</Text>}
              {item.serial_number && <Text style={[s.tableCell, { color: '#94a3b8', fontSize: 7 }]}>S/N: {item.serial_number}</Text>}
            </View>
            <Text style={[s.tableCell, s.col_hsn]}>{item.hsn_code ?? '—'}</Text>
            <Text style={[s.tableCell, s.col_qty]}>{item.quantity}</Text>
            <Text style={[s.tableCell, s.col_rate]}>₹{round2(item.rate).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_disc]}>₹{round2(item.discount).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_taxable]}>₹{round2(item.taxable_amount).toFixed(2)}</Text>
            <Text style={[s.tableCell, s.col_gst]}>{item.gst_rate}%</Text>
            {isIntraState ? (
              <>
                <Text style={[s.tableCell, s.col_cgst]}>₹{round2(item.cgst).toFixed(2)}</Text>
                <Text style={[s.tableCell, s.col_sgst]}>₹{round2(item.sgst).toFixed(2)}</Text>
              </>
            ) : (
              <Text style={[s.tableCell, s.col_igst]}>₹{round2(item.igst).toFixed(2)}</Text>
            )}
            <Text style={[s.tableCell, s.col_total, { fontFamily: 'Helvetica-Bold' }]}>₹{round2(item.total).toFixed(2)}</Text>
          </View>
        ))}

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
                <Text style={[s.totalValue, { color: GREEN }]}>−₹{round2(invoice.discount).toFixed(2)}</Text>
              </View>
            )}
            {taxableAmount > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Taxable Amount</Text>
                <Text style={s.totalValue}>₹{round2(taxableAmount).toFixed(2)}</Text>
              </View>
            )}
            {taxableAmount > 0 && (isIGST ? (
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
            {nonTaxableItems.map((item) => (
              <View key={item.id} style={s.totalRow}>
                <Text style={s.totalLabel}>
                  {item.product_name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </Text>
                <Text style={s.totalValue}>₹{round2(item.total).toFixed(2)}</Text>
              </View>
            ))}
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>₹{round2(invoice.grand_total).toFixed(2)}</Text>
            </View>
            <View style={s.amountWordsBox}>
              <Text style={s.amountWordsLabel}>Amount in Words</Text>
              <Text style={s.amountWordsText}>{amountInWords(round2(invoice.grand_total))}</Text>
            </View>
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
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>This is a computer-generated invoice. No signature required.</Text>
          <Text style={s.footerText}>{STORE.name} · GSTIN: {STORE.gstin} · {STORE.phone}</Text>
        </View>

        {/* Bottom border */}
        <View style={s.borderBottom}>
          <Text style={s.borderBottomText}>Dubaishoppe_hyd@yahoo.com</Text>
          <Text style={s.borderBottomSep}>|</Text>
          <Text style={s.borderBottomText}>+91 9885878645 / +91 9866141485</Text>
          <Text style={s.borderBottomSep}>|</Text>
          <Text style={s.borderBottomText}>DUBAI SHOPPE — GSTIN: 36ALBPM0907C1ZO</Text>
        </View>

      </Page>
    </Document>
  )
}
