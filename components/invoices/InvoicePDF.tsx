import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { STORE } from '@/lib/store-constants'
import type { Invoice, InvoiceItem, Customer } from '@/types/database'
import { round2 } from '@/lib/gst'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', padding: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  storeName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  storeDetail: { fontSize: 8, color: '#64748b', marginTop: 2 },
  invoiceTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#2563eb', textAlign: 'right' },
  invoiceDetail: { fontSize: 8, color: '#64748b', textAlign: 'right', marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  billRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  billBox: { flex: 1 },
  billLabel: { fontSize: 7, color: '#94a3b8', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  billValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  billSub: { fontSize: 8, color: '#64748b', marginTop: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' },
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
  totalsBox: { width: 200 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: '#64748b' },
  totalValue: { fontSize: 8 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 2 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2563eb' },
  footer: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94a3b8' },
  gstnBadge: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  gstnText: { fontSize: 7, color: '#0369a1', fontFamily: 'Helvetica-Bold' },
})

interface InvoicePDFProps {
  invoice: Invoice
  items: InvoiceItem[]
  customer: Customer | null
}

export function InvoicePDF({ invoice, items, customer }: InvoicePDFProps) {
  const isIGST = invoice.igst > 0
  const isIntraState = !isIGST

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.storeName}>{STORE.name}</Text>
            <Text style={s.storeDetail}>{STORE.address}</Text>
            <Text style={s.storeDetail}>{STORE.city}</Text>
            <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
            <View style={[s.gstnBadge, { marginTop: 4, alignSelf: 'flex-start' }]}>
              <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
            </View>
          </View>
          <View>
            <Text style={s.invoiceTitle}>TAX INVOICE</Text>
            <Text style={s.invoiceDetail}>Invoice No: {invoice.invoice_no}</Text>
            <Text style={s.invoiceDetail}>Date: {new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
            <Text style={s.invoiceDetail}>Payment: {invoice.payment_method?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.billRow}>
          <View style={s.billBox}>
            <Text style={s.billLabel}>Bill To</Text>
            <Text style={s.billValue}>{customer ? customer.name : 'Walk-in Customer'}</Text>
            {customer?.phone && <Text style={s.billSub}>Ph: {customer.phone}</Text>}
            {customer?.address && <Text style={s.billSub}>{customer.address}</Text>}
            {customer?.gstin && <Text style={s.billSub}>GSTIN: {customer.gstin}</Text>}
            {customer && <Text style={s.billSub}>State: {customer.state}</Text>}
          </View>
        </View>

        <View style={s.divider} />

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

        <View style={s.totalsSection}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>₹{round2(invoice.subtotal).toFixed(2)}</Text>
            </View>
            {invoice.discount > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Discount</Text>
                <Text style={[s.totalValue, { color: '#16a34a' }]}>−₹{round2(invoice.discount).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Taxable Amount</Text>
              <Text style={s.totalValue}>₹{round2(invoice.taxable_amount).toFixed(2)}</Text>
            </View>
            {isIntraState ? (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>CGST</Text>
                  <Text style={s.totalValue}>₹{round2(invoice.cgst).toFixed(2)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>SGST</Text>
                  <Text style={s.totalValue}>₹{round2(invoice.sgst).toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>IGST</Text>
                <Text style={s.totalValue}>₹{round2(invoice.igst).toFixed(2)}</Text>
              </View>
            )}
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>₹{round2(invoice.grand_total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>This is a computer-generated invoice. No signature required.</Text>
          <Text style={s.footerText}>{STORE.name} · GSTIN: {STORE.gstin}</Text>
        </View>
      </Page>
    </Document>
  )
}
