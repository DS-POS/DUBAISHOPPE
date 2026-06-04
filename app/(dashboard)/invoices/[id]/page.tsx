import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/actions/invoices'
import { getInvoicePayments } from '@/actions/invoice-payments'
import { InvoiceShareButtons } from '@/components/invoices/InvoiceShareButtons'
import { RecordPaymentDialog } from '@/components/invoices/RecordPaymentDialog'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()

  const payments = await getInvoicePayments(invoice.id)

  const customer = invoice.customers
  const items = invoice.invoice_items ?? []
  const isIGST = invoice.igst > 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeftIcon className="size-3.5" /> Invoices
          </Link>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {invoice.invoice_no}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(invoice.created_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <InvoiceShareButtons
            invoiceId={invoice.id}
            invoiceNo={invoice.invoice_no}
            grandTotal={invoice.grand_total}
            customerEmail={customer?.email ?? null}
            customerPhone={customer?.phone ?? null}
          />
          {invoice.status !== 'cancelled' && (
            <Link
              href={`/invoices/${invoice.id}/return`}
              className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              ↩ Return
            </Link>
          )}
        </div>
      </div>

      {/* Customer Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-base">{customer ? customer.name : 'Walk-in Customer'}</p>
            {customer?.business_name && (
              <p className="text-sm text-muted-foreground">{customer.business_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-semibold ${
              invoice.status === 'paid'
                ? 'bg-emerald-100 text-emerald-700'
                : invoice.status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {invoice.status === 'pending' ? 'Due' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize">
              {invoice.payment_method ?? '—'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {customer?.phone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{customer.phone}</p>
            </div>
          )}
          {customer?.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium break-all">{customer.email}</p>
            </div>
          )}
          {customer?.gstin && (
            <div>
              <p className="text-xs text-muted-foreground">GSTIN</p>
              <p className="font-medium font-mono text-xs">{customer.gstin}</p>
            </div>
          )}
          {customer?.state && (
            <div>
              <p className="text-xs text-muted-foreground">State</p>
              <p className="font-medium">{customer.state}</p>
            </div>
          )}
          {customer?.address && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-medium">{customer.address}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rate</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxable</th>
              {isIGST
                ? <th className="px-3 py-2 text-right font-medium text-muted-foreground">IGST</th>
                : <>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">CGST</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">SGST</th>
                  </>
              }
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                  {item.serial_number && <p className="text-xs text-muted-foreground font-mono">S/N: {item.serial_number}</p>}
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">₹{round2(item.rate).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">₹{round2(item.taxable_amount).toFixed(2)}</td>
                {isIGST
                  ? <td className="px-3 py-2 text-right">₹{round2(item.igst).toFixed(2)}</td>
                  : <>
                      <td className="px-3 py-2 text-right">₹{round2(item.cgst).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{round2(item.sgst).toFixed(2)}</td>
                    </>
                }
                <td className="px-3 py-2 text-right font-semibold">₹{round2(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>₹{round2(invoice.subtotal).toFixed(2)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span><span className="text-emerald-600">−₹{round2(invoice.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable Amount</span><span>₹{round2(invoice.taxable_amount).toFixed(2)}</span>
          </div>
          {isIGST ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span><span>₹{round2(invoice.igst).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span><span>₹{round2(invoice.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span><span>₹{round2(invoice.sgst).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span><span>₹{round2(invoice.grand_total).toFixed(2)}</span>
          </div>
          {/* Payment breakdown */}
          <div className="flex justify-between text-sm border-t border-border pt-2 mt-1">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="text-emerald-600 font-semibold">₹{round2(invoice.amount_paid).toFixed(2)}</span>
          </div>
          {(() => {
            const due = round2(invoice.grand_total - invoice.amount_paid)
            return due > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-red-600">Balance Due</span>
                <span className="font-bold text-red-600 text-base">₹{due.toFixed(2)}</span>
              </div>
            ) : null
          })()}
        </div>
      </div>

      {/* Payment History + Record Payment */}
      <RecordPaymentDialog
        invoiceId={invoice.id}
        grandTotal={invoice.grand_total}
        amountPaid={invoice.amount_paid}
        payments={payments}
        invoiceStatus={invoice.status}
      />
    </div>
  )
}
