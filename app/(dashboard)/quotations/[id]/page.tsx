import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getQuotation } from '@/actions/quotations'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'
import type { QuotationStatus } from '@/types/database'
import { QuotationActions } from '@/components/quotations/QuotationActions'

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
}

const STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quotation = await getQuotation(id)
  if (!quotation) notFound()

  const customer = quotation.customers
  const items = quotation.quotation_items ?? []
  const isIGST = quotation.igst > 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/quotations"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeftIcon className="size-3.5" /> Quotations
          </Link>
          <h1
            className="text-2xl font-bold text-[#111827]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            {quotation.quotation_no}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(quotation.created_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        <QuotationActions
          quotationId={quotation.id}
          quotationNo={quotation.quotation_no}
          status={quotation.status}
          convertedInvoiceId={quotation.converted_invoice_id}
          grandTotal={quotation.grand_total}
          customerPhone={customer?.phone ?? null}
        />
      </div>

      {/* Customer Card */}
      <div className="rounded-xl border border-border bg-[#F3F4F6] p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-base text-[#111827]">
              {customer ? customer.name : 'Walk-in Customer'}
            </p>
            {customer?.business_name && (
              <p className="text-sm text-muted-foreground">{customer.business_name}</p>
            )}
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[quotation.status]}`}
          >
            {STATUS_LABELS[quotation.status]}
          </span>
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
        {quotation.valid_until && (
          <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
            <p className="text-xs text-muted-foreground">Valid Until</p>
            <p className="font-medium text-sm mt-0.5">
              {format(new Date(quotation.valid_until), 'dd MMM yyyy')}
            </p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#111827] border-b border-[#1F2937]">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-300">#</th>
              <th className="px-3 py-2 text-left font-medium text-slate-300">Product</th>
              <th className="px-3 py-2 text-right font-medium text-slate-300">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-slate-300">Rate</th>
              <th className="px-3 py-2 text-right font-medium text-slate-300">Taxable</th>
              {isIGST
                ? <th className="px-3 py-2 text-right font-medium text-slate-300">IGST</th>
                : <>
                    <th className="px-3 py-2 text-right font-medium text-slate-300">CGST</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-300">SGST</th>
                  </>
              }
              <th className="px-3 py-2 text-right font-medium text-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
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

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>₹{round2(quotation.subtotal).toFixed(2)}</span>
          </div>
          {quotation.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="text-emerald-600">−₹{round2(quotation.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable Amount</span><span>₹{round2(quotation.taxable_amount).toFixed(2)}</span>
          </div>
          {isIGST ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span><span>₹{round2(quotation.igst).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span><span>₹{round2(quotation.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span><span>₹{round2(quotation.sgst).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span><span>₹{round2(quotation.grand_total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
        </div>
      )}
    </div>
  )
}
