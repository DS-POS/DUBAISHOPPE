import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/actions/invoices'
import { InvoiceShareButtons } from '@/components/invoices/InvoiceShareButtons'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()

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
        <InvoiceShareButtons
          invoiceId={invoice.id}
          invoiceNo={invoice.invoice_no}
          grandTotal={invoice.grand_total}
          customerEmail={customer?.email ?? null}
          customerPhone={customer?.phone ?? null}
        />
      </div>

      <div className="rounded-xl border border-border p-4 text-sm space-y-1">
        <p className="font-medium">{customer ? customer.name : 'Walk-in Customer'}</p>
        {customer?.phone && <p className="text-muted-foreground">Ph: {customer.phone}</p>}
        {customer?.address && <p className="text-muted-foreground">{customer.address}</p>}
        {customer?.gstin && <p className="text-muted-foreground font-mono text-xs">GSTIN: {customer.gstin}</p>}
        <p className="text-muted-foreground text-xs">
          Payment: <span className="capitalize font-medium text-foreground">{invoice.payment_method}</span>
          {' · '}Status: <span className={`font-medium ${invoice.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>{invoice.status}</span>
        </p>
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
        </div>
      </div>
    </div>
  )
}
