import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { STORE } from '@/lib/store-constants'
import type { Quotation, QuotationItem, Customer } from '@/types/database'
import type { BankAccount } from '@/actions/settings'
import { round2 } from '@/lib/gst'
import path from 'path'
import fs from 'fs'

const _logoPath = path.join(process.cwd(), 'public', 'DUBAI LOGO BR.png')
const LOGO_SRC = `data:image/png;base64,${fs.readFileSync(_logoPath).toString('base64')}`

const _stampPath = path.join(process.cwd(), 'public', 'stamp.png')
const STAMP_SRC = `data:image/png;base64,${fs.readFileSync(_stampPath).toString('base64')}`

Font.register({
  family: 'SegoeUI',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'SegoeUI-Italic.ttf'), fontStyle: 'italic' },
  ],
})

const ACCENT = '#4B5563'
const DARK = '#111827'
const BODY = '#1f2937'
const MUTED = '#6B7280'
const BG_LIGHT = '#F9FAFB'
const BG_MID = '#F3F4F6'
const BORDER = '#D1D5DB'

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
  page: { fontFamily: 'SegoeUI', fontSize: 9, color: BODY, paddingHorizontal: 32, paddingTop: 14, paddingBottom: 0 },

  // TOP BAR — doc number + date left, title right
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarDocNo: {
    fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK,
    backgroundColor: BG_MID, paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 2, borderWidth: 0.5, borderColor: BORDER,
  },
  topBarDate: { fontSize: 8, color: MUTED },
  topBarValidUntil: { fontSize: 7.5, color: MUTED, fontFamily: 'SegoeUI', fontStyle: 'italic' },
  topBarTitle: { fontSize: 11, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK, opacity: 0.28 },

  // DIVIDERS
  dividerAccent: { borderBottomWidth: 1, borderBottomColor: ACCENT, marginBottom: 8 },
  dividerThin: { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginVertical: 7 },

  // HEADER ROW — logo | store | bill-to
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  logoCol: { alignItems: 'center', justifyContent: 'flex-start', paddingRight: 8, paddingTop: 2 },
  logoImg: { width: 80, height: 80 },
  logoClip: { width: 80, height: 52, overflow: 'hidden' },
  headerDividerV: { width: 0.5, backgroundColor: BORDER, marginHorizontal: 10, alignSelf: 'stretch' },
  storeCol: { flex: 1.1, paddingVertical: 2 },
  storeName: { fontSize: 12, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK },
  storeTagline: { fontSize: 7, color: MUTED, marginTop: 1, marginBottom: 4, fontFamily: 'SegoeUI', fontWeight: 'bold' },
  storeDetail: { fontSize: 7.5, color: BODY, marginTop: 2 },
  gstnBadge: {
    backgroundColor: BG_MID, borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 2, marginTop: 4, alignSelf: 'flex-start',
  },
  gstnText: { fontSize: 7, color: ACCENT, fontFamily: 'SegoeUI', fontWeight: 'bold' },
  billCol: { flex: 1, paddingVertical: 2 },
  billLabel: { fontSize: 7, color: ACCENT, fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 3 },
  billValue: { fontSize: 9, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK },
  billSub: { fontSize: 8, color: BODY, marginTop: 2 },
  custGstnBadge: {
    backgroundColor: BG_MID, borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 2, marginTop: 3, alignSelf: 'flex-start',
  },

  // TABLE
  tableHeader: { flexDirection: 'row', backgroundColor: DARK, paddingVertical: 4, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: BG_LIGHT },
  tableCell: { fontSize: 8, color: BODY },
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

  // TOTALS
  totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  totalsBox: { width: 210 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: MUTED },
  totalValue: { fontSize: 8, color: BODY, fontFamily: 'SegoeUI', fontWeight: 'bold' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: DARK, borderRadius: 3, marginTop: 4,
  },
  grandTotalLabel: { fontSize: 10, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#FFFFFF' },
  grandTotalValue: { fontSize: 10, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#FFFFFF' },
  amountWordsBox: {
    backgroundColor: BG_MID, borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, marginTop: 4,
  },
  amountWordsLabel: { fontSize: 6.5, color: MUTED, fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  amountWordsText: { fontSize: 8, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK },
  validUntilBox: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 3, paddingHorizontal: 8,
    backgroundColor: BG_MID, borderRadius: 2, borderWidth: 0.5, borderColor: BORDER, marginTop: 3,
  },
  validUntilLabel: { fontSize: 8, color: MUTED },
  validUntilValue: { fontSize: 8, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK },
  notesBox: {
    backgroundColor: BG_LIGHT, borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, marginTop: 8,
  },
  notesLabel: { fontSize: 6.5, color: MUTED, fontFamily: 'SegoeUI', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  notesText: { fontSize: 8, color: BODY },

  // BOTTOM SECTION
  bottomSection: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bankBox: {
    flex: 45, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: DARK,
  },
  tcBox: {
    flex: 50, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: DARK,
  },
  bottomBoxTitle: { fontSize: 7, fontFamily: 'SegoeUI', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.6 },
  bankRow: { flexDirection: 'row', marginBottom: 3 },
  bankLabel: { fontSize: 7.5, color: 'rgba(255,255,255,0.65)', width: 80 },
  bankValue: { fontSize: 8, color: '#FFFFFF', fontFamily: 'SegoeUI', fontWeight: 'bold', flex: 1 },
  tcItem: { flexDirection: 'row', marginBottom: 2 },
  tcBullet: { fontSize: 7, color: 'rgba(255,255,255,0.6)', marginRight: 4, width: 8 },
  tcText: { fontSize: 6.5, color: 'rgba(255,255,255,0.82)', flex: 1 },

  // SIGNATURE
  signatureSection: { alignItems: 'flex-end', marginTop: 8 },
  signatureBox: {
    width: 180, borderWidth: 0.3, borderColor: '#F0F1F2',
    borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: '#FFFFFF', alignItems: 'center',
  },
  signatureLine: { borderTopWidth: 0.3, borderTopColor: '#F0F1F2', width: '100%', marginBottom: 3 },
  signatureLabel: { fontSize: 7, fontFamily: 'SegoeUI', fontWeight: 'bold', color: DARK, textAlign: 'center' },
  stampImg: { width: 90, height: 90, objectFit: 'contain', marginBottom: 3 },

  // FOOTER — thin single row
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, marginTop: 5 },
  footerText: { fontSize: 6, color: MUTED },

  // DARK BOTTOM BAR
  borderBottom: {
    backgroundColor: DARK,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderBottomText: { fontSize: 7, color: 'rgba(255,255,255,0.7)', fontFamily: 'SegoeUI', fontWeight: 'bold' },
  borderBottomSep: { fontSize: 7, color: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
})

interface QuotationPDFProps {
  quotation: Quotation
  items: QuotationItem[]
  customer: Customer | null
  bankAccount?: BankAccount | null
  termsConditions?: string[]
}

export function QuotationPDF({ quotation, items, customer, bankAccount, termsConditions }: QuotationPDFProps) {
  const isIGST = quotation.igst > 0
  const isIntraState = !isIGST
  const hasDiscount = items.some(item => round2(item.discount) > 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Top bar: doc number + date | title */}
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <Text style={s.topBarDocNo}>{quotation.quotation_no}</Text>
            <Text style={s.topBarDate}>{new Date(quotation.created_at).toLocaleDateString('en-IN')}</Text>
            {quotation.valid_until && (
              <Text style={s.topBarValidUntil}>
                Valid until: {new Date(quotation.valid_until).toLocaleDateString('en-IN')}
              </Text>
            )}
          </View>
          <Text style={s.topBarTitle}>ORIGINAL QUOTATION</Text>
        </View>

        <View style={s.dividerAccent} />

        {/* Header: Logo | Store details | Bill To */}
        <View style={s.headerRow}>
          <View style={s.logoCol}>
            <View style={s.logoClip}>
              <Image src={LOGO_SRC} style={s.logoImg} />
            </View>
          </View>
          <View style={s.headerDividerV} />
          <View style={s.storeCol}>
            <Text style={s.storeName}>{STORE.name}</Text>
            <Text style={s.storeTagline}>GEAR FOR PHOTO, VIDEO & CREATIVE PROFESSIONALS</Text>
            <Text style={s.storeDetail}>{STORE.address}</Text>
            <Text style={s.storeDetail}>{STORE.city}</Text>
            <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
            <Text style={s.storeDetail}>Email: {STORE.email}</Text>
            <View style={s.gstnBadge}>
              <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
            </View>
          </View>
          <View style={s.headerDividerV} />
          <View style={s.billCol}>
            <Text style={s.billLabel}>Quote To</Text>
            <Text style={s.billValue}>{customer ? customer.name : 'Walk-in Customer'}</Text>
            {customer?.business_name && <Text style={s.billSub}>{customer.business_name}</Text>}
            {customer?.phone && <Text style={s.billSub}>Ph: {customer.phone}</Text>}
            {customer?.email && <Text style={s.billSub}>Email: {customer.email}</Text>}
            {customer?.address && <Text style={s.billSub}>{customer.address}</Text>}
            {customer?.gstin && (
              <View style={s.custGstnBadge}>
                <Text style={s.gstnText}>GSTIN: {customer.gstin}</Text>
              </View>
            )}
            {customer?.state && <Text style={[s.billSub, { marginTop: 2 }]}>State: {customer.state}</Text>}
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* Table */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.col_no]}>#</Text>
          <Text style={[s.tableHeaderCell, s.col_desc]}>Description</Text>
          <Text style={[s.tableHeaderCell, s.col_hsn]}>HSN</Text>
          <Text style={[s.tableHeaderCell, s.col_qty]}>Qty</Text>
          <Text style={[s.tableHeaderCell, s.col_rate]}>Rate</Text>
          {hasDiscount && <Text style={[s.tableHeaderCell, s.col_disc]}>Disc.</Text>}
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
          <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, s.col_no]}>{i + 1}</Text>
            <View style={s.col_desc}>
              <Text style={[s.tableCell, { fontFamily: 'SegoeUI', fontWeight: 'bold' }]}>{item.product_name}</Text>
              {item.sku && <Text style={[s.tableCell, { color: MUTED, fontSize: 7 }]}>{item.sku}</Text>}
            </View>
            <Text style={[s.tableCell, s.col_hsn]}>{item.hsn_code ?? '—'}</Text>
            <Text style={[s.tableCell, s.col_qty]}>{item.quantity}</Text>
            <Text style={[s.tableCell, s.col_rate]}>₹{round2(item.rate).toFixed(2)}</Text>
            {hasDiscount && (
              <Text style={[s.tableCell, s.col_disc]}>
                {round2(item.discount) > 0 ? `₹${round2(item.discount).toFixed(2)}` : '—'}
              </Text>
            )}
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
            <Text style={[s.tableCell, s.col_total, { fontFamily: 'SegoeUI', fontWeight: 'bold' }]}>₹{round2(item.total).toFixed(2)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>₹{round2(quotation.subtotal).toFixed(2)}</Text>
            </View>
            {quotation.discount > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Discount</Text>
                <Text style={[s.totalValue, { color: ACCENT }]}>−₹{round2(quotation.discount).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Taxable Amount</Text>
              <Text style={s.totalValue}>₹{round2(quotation.taxable_amount).toFixed(2)}</Text>
            </View>
            {isIntraState ? (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>CGST</Text>
                  <Text style={s.totalValue}>₹{round2(quotation.cgst).toFixed(2)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>SGST</Text>
                  <Text style={s.totalValue}>₹{round2(quotation.sgst).toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>IGST</Text>
                <Text style={s.totalValue}>₹{round2(quotation.igst).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>₹{round2(quotation.grand_total).toFixed(2)}</Text>
            </View>
            <View style={s.amountWordsBox}>
              <Text style={s.amountWordsLabel}>Amount in Words</Text>
              <Text style={s.amountWordsText}>{amountInWords(round2(quotation.grand_total))}</Text>
            </View>
            {quotation.valid_until && (
              <View style={s.validUntilBox}>
                <Text style={s.validUntilLabel}>Valid Until</Text>
                <Text style={s.validUntilValue}>{new Date(quotation.valid_until).toLocaleDateString('en-IN')}</Text>
              </View>
            )}
          </View>
        </View>

        {quotation.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{quotation.notes}</Text>
          </View>
        )}

        {/* Bank Details + Terms */}
        {(bankAccount || (termsConditions && termsConditions.length > 0)) && (
          <View style={s.bottomSection}>
            {bankAccount && (
              <View style={s.bankBox}>
                <Text style={s.bottomBoxTitle}>Bank Details</Text>
                {[
                  ['Bank Name', bankAccount.bank_name],
                  ['Account Name', bankAccount.account_name],
                  ['Account No.', bankAccount.account_number],
                  ['IFSC Code', bankAccount.ifsc],
                  ['Branch', bankAccount.branch],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <View key={label} style={s.bankRow}>
                    <Text style={s.bankLabel}>{label}</Text>
                    <Text style={s.bankValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
            {termsConditions && termsConditions.length > 0 && (
              <View style={s.tcBox}>
                <Text style={s.bottomBoxTitle}>Terms &amp; Conditions</Text>
                {termsConditions.map((term, i) => (
                  <View key={i} style={s.tcItem}>
                    <Text style={s.tcBullet}>•</Text>
                    <Text style={s.tcText}>{term}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Signature + Footer + Dark bar — no page break within */}
        <View wrap={false}>
          <View style={s.signatureSection}>
            <View style={s.signatureBox}>
              <Image src={STAMP_SRC} style={s.stampImg} />
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>AUTHORIZED SIGNATURE</Text>
            </View>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Computer-generated quotation. Prices subject to change.</Text>
            <Text style={s.footerText}>{STORE.name} · GSTIN: {STORE.gstin} · {STORE.phone}</Text>
          </View>

          <View style={s.borderBottom}>
            <Text style={s.borderBottomText}>{STORE.email}</Text>
            <Text style={s.borderBottomSep}>|</Text>
            <Text style={s.borderBottomText}>{STORE.phone}</Text>
            <Text style={s.borderBottomSep}>|</Text>
            <Text style={s.borderBottomText}>GSTIN: {STORE.gstin}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
