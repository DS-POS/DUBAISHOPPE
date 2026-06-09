import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice, getLinkedInvoice } from '@/actions/invoices'
import { getInvoicePayments } from '@/actions/invoice-payments'
import { getInvoiceReturns } from '@/actions/sales-returns'
import { getCustomerRefundsByGroup, getCustomerRefundsByInvoice } from '@/actions/customer-refunds'
import { InvoiceShareButtons } from '@/components/invoices/InvoiceShareButtons'
import { RecordPaymentDialog } from '@/components/invoices/RecordPaymentDialog'
import { RecordCustomerRefundButton } from '@/components/invoices/RecordCustomerRefundButton'
import { DeleteInvoiceButton } from '@/components/invoices/DeleteInvoiceButton'
import { ThermalReceipt } from '@/components/invoice/ThermalReceipt'
import { PrintReceiptButton } from '@/components/invoice/PrintReceiptButton'
import { format } from 'date-fns'
import { round2 } from '@/lib/gst'
import { ArrowLeftIcon } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()

  const [payments, returns, linkedInvoice] = await Promise.all([
    getInvoicePayments(invoice.id),
    getInvoiceReturns(invoice.id),
    invoice.order_group_id
      ? getLinkedInvoice(invoice.order_group_id, invoice.id)
      : Promise.resolve(null),
  ])

  const customerRefunds = invoice.order_group_id
    ? await getCustomerRefundsByGroup(invoice.order_group_id)
    : await getCustomerRefundsByInvoice(invoice.id)

  const customer = invoice.customers
  const items = invoice.invoice_items ?? []
  const isIGST = invoice.igst > 0

  return (
    <div className="space-y-4 w-full max-w-full md:max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#111827] via-[#1e2d40] to-[#1a3a5c] px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Link href="/invoices" className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition-colors">
                <ArrowLeftIcon className="size-3.5" /> Invoices
              </Link>
              <h1 className="text-2xl font-black text-white tracking-tight">{invoice.invoice_no}</h1>
              <p className="text-slate-400 text-sm mt-1">
                {format(new Date(invoice.created_at), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <PrintReceiptButton invoiceId={invoice.id} />
                <InvoiceShareButtons
                  invoiceId={invoice.id}
                  invoiceNo={invoice.invoice_no}
                  grandTotal={invoice.grand_total}
                  customerEmail={customer?.email ?? null}
                  customerPhone={customer?.phone ?? null}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {invoice.status !== 'cancelled' && (
                  <Link
                    href={`/invoices/${invoice.id}/return`}
                    className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ↩ Return
                  </Link>
                )}
                <DeleteInvoiceButton invoiceId={invoice.id} invoiceNo={invoice.invoice_no} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main card: Customer + Items + Payment Summary */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">

        {/* Card header — light with status badges */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice Summary</h2>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              invoice.status === 'paid'
                ? 'bg-emerald-100 text-emerald-700'
                : invoice.status === 'cancelled'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {invoice.status === 'pending' ? 'Due' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${invoice.payment_method === 'insurance' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
              {invoice.payment_method === 'insurance' ? '🛡 Insurance' : (invoice.payment_method ?? '—')}
            </span>
          </div>
        </div>

        {/* Customer details */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer</p>
          <p className="font-bold text-lg text-slate-900">{customer ? customer.name : 'Walk-in Customer'}</p>
          {customer?.business_name && <p className="text-sm text-slate-500">{customer.business_name}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3">
            {customer?.phone && (
              <div><p className="text-xs text-slate-400 font-medium">Phone</p><p className="font-semibold text-slate-800">{customer.phone}</p></div>
            )}
            {customer?.email && (
              <div><p className="text-xs text-slate-400 font-medium">Email</p><p className="font-semibold text-slate-800 break-all">{customer.email}</p></div>
            )}
            {customer?.gstin && (
              <div><p className="text-xs text-slate-400 font-medium">GSTIN</p><p className="font-semibold text-slate-800 font-mono text-xs">{customer.gstin}</p></div>
            )}
            {customer?.state && (
              <div><p className="text-xs text-slate-400 font-medium">State</p><p className="font-semibold text-slate-800">{customer.state}</p></div>
            )}
            {customer?.address && (
              <div className="col-span-2 sm:col-span-3"><p className="text-xs text-slate-400 font-medium">Address</p><p className="font-semibold text-slate-800">{customer.address}</p></div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="border-b border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice Items</p>
          </div>
          {/* Mobile: item cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 leading-tight">{item.product_name}</p>
                    {item.sku && <p className="text-xs text-slate-400 mt-0.5">{item.sku}</p>}
                    {item.serial_number && <p className="text-xs text-slate-400 font-mono">S/N: {item.serial_number}</p>}
                  </div>
                  <p className="font-bold text-sm text-slate-900 shrink-0 tabular-nums">₹{round2(item.total).toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>Qty: <b>{item.quantity}</b></span>
                  <span>Rate: ₹{round2(item.rate).toFixed(2)}</span>
                  <span>Taxable: ₹{round2(item.taxable_amount).toFixed(2)}</span>
                  {isIGST
                    ? <span>IGST: ₹{round2(item.igst).toFixed(2)}</span>
                    : <>
                        <span>CGST: ₹{round2(item.cgst).toFixed(2)}</span>
                        <span>SGST: ₹{round2(item.sgst).toFixed(2)}</span>
                      </>
                  }
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111827]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Taxable</th>
                  {isIGST
                    ? <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">IGST</th>
                    : <>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">CGST</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">SGST</th>
                      </>
                  }
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.product_name}</p>
                      {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                      {item.serial_number && <p className="text-xs text-slate-400 font-mono">S/N: {item.serial_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.rate).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.taxable_amount).toFixed(2)}</td>
                    {isIGST
                      ? <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.igst).toFixed(2)}</td>
                      : <>
                          <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.cgst).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">₹{round2(item.sgst).toFixed(2)}</td>
                        </>
                    }
                    <td className="px-4 py-3 text-right font-bold text-slate-900">₹{round2(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="px-5 pt-4 pb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Payment Summary</p>
          <div className="flex justify-end">
            <div className="w-full md:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span>₹{round2(invoice.subtotal).toFixed(2)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span><span>−₹{round2(invoice.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Taxable Amount</span><span>₹{round2(invoice.taxable_amount).toFixed(2)}</span>
              </div>
              {isIGST ? (
                <div className="flex justify-between text-slate-500">
                  <span>IGST</span><span>₹{round2(invoice.igst).toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST</span><span>₹{round2(invoice.cgst).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST</span><span>₹{round2(invoice.sgst).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-black text-lg border-t border-slate-200 pt-3 mt-1 bg-slate-50 -mx-5 px-5 py-3 text-slate-900">
                <span>Grand Total</span><span>₹{round2(invoice.grand_total).toFixed(2)}</span>
              </div>
              {(invoice.total_returns ?? 0) > 0 && (
                <>
                  {returns.map(r => (
                    <div key={r.id} className="flex justify-between text-amber-700 text-xs">
                      <span>Return {r.return_no} <span className="text-slate-400">({r.refund_method === 'balance_adjustment' ? 'Applied to balance' : r.refund_method})</span></span>
                      <span>−₹{round2(r.total_refund).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-700">
                    <span>Net Amount</span>
                    <span>₹{round2(invoice.grand_total - (invoice.total_returns ?? 0)).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Amount Paid</span>
                <span className="text-emerald-600 font-semibold">₹{round2(invoice.amount_paid).toFixed(2)}</span>
              </div>
              {invoice.payment_method === 'insurance' && (invoice.insurance_company || invoice.insurance_claim_no) && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🛡</span> Insurance Payment
                  </p>
                  {invoice.insurance_company && (
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600">Company</span>
                      <span className="font-semibold text-blue-800">{invoice.insurance_company}</span>
                    </div>
                  )}
                  {invoice.insurance_claim_no && (
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600">Claim No.</span>
                      <span className="font-semibold text-blue-800 font-mono">{invoice.insurance_claim_no}</span>
                    </div>
                  )}
                </div>
              )}
              {!linkedInvoice && (() => {
                const due = round2(invoice.grand_total - (invoice.total_returns ?? 0) - invoice.amount_paid)
                return due > 0 ? (
                  <div className="flex justify-between">
                    <span className="font-bold text-red-600">Balance Due</span>
                    <span className="font-black text-red-600 text-lg">₹{due.toFixed(2)}</span>
                  </div>
                ) : due < 0 ? (
                  <div className="pt-1 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="font-bold text-emerald-600">Refund Due to Customer</span>
                      <span className="font-black text-emerald-600 text-lg">₹{Math.abs(due).toFixed(2)}</span>
                    </div>
                    <RecordCustomerRefundButton
                      invoiceId={invoice.id}
                      orderGroupId={null}
                      refundAmount={Math.abs(due)}
                      existingRefunds={customerRefunds}
                    />
                  </div>
                ) : null
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Order Balance — only for split orders with outstanding balance */}
      {linkedInvoice && (() => {
        const groupTotal = round2(invoice.grand_total + linkedInvoice.grand_total)
        const groupPaid = round2(invoice.amount_paid + linkedInvoice.amount_paid)
        const groupReturns = round2((invoice.total_returns ?? 0) + (linkedInvoice.total_returns ?? 0))
        const groupBalance = round2(groupTotal - groupPaid - groupReturns)
        const isRefund = groupBalance < 0
        const isSettled = groupBalance === 0
        // Hide when fully paid — no outstanding balance to show
        if (isSettled) return null
        return (
          <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-5 py-3.5">
              <h2 className="text-sm font-bold text-white">Order Balance Summary</h2>
              <p className="text-xs text-teal-100 mt-0.5">Combined total for this split order (Tax Invoice + Bill of Supply)</p>
            </div>
            <div className="p-5 flex justify-end">
              <div className="w-full md:w-72 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Tax Invoice ({invoice.invoice_type === 'tax_invoice' ? invoice.invoice_no : linkedInvoice.invoice_no})</span>
                  <span>₹{round2(invoice.invoice_type === 'tax_invoice' ? invoice.grand_total : linkedInvoice.grand_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Bill of Supply ({invoice.invoice_type === 'bill_of_supply' ? invoice.invoice_no : linkedInvoice.invoice_no})</span>
                  <span>₹{round2(invoice.invoice_type === 'bill_of_supply' ? invoice.grand_total : linkedInvoice.grand_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-base border-t border-slate-200 pt-3 mt-1 bg-slate-50 -mx-5 px-5 py-3 text-slate-900">
                  <span>Order Total</span><span>₹{groupTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Total Paid</span>
                  <span className="text-emerald-600 font-semibold">₹{groupPaid.toFixed(2)}</span>
                </div>
                {groupReturns > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Total Returns</span>
                    <span className="font-semibold">−₹{groupReturns.toFixed(2)}</span>
                  </div>
                )}
                {isSettled ? (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="font-bold text-emerald-600">Order Settled</span>
                    <span className="font-black text-emerald-600 text-lg">NIL</span>
                  </div>
                ) : isRefund ? (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-600">Refund Due to Customer</span>
                      <span className="font-black text-emerald-600 text-lg">₹{Math.abs(groupBalance).toFixed(2)}</span>
                    </div>
                    <RecordCustomerRefundButton
                      invoiceId={invoice.id}
                      orderGroupId={invoice.order_group_id}
                      refundAmount={Math.abs(groupBalance)}
                      existingRefunds={customerRefunds}
                    />
                  </div>
                ) : (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="font-bold text-red-600">Order Balance Due</span>
                    <span className="font-black text-red-600 text-lg">₹{groupBalance.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* BOS linked document — separate card */}
      {linkedInvoice && (() => {
        const linkedItems = linkedInvoice.invoice_items ?? []
        const isBOS = linkedInvoice.invoice_type === 'bill_of_supply'
        const headerCls = isBOS
          ? 'bg-amber-50 border-b border-amber-200'
          : 'bg-blue-50 border-b border-blue-200'
        const titleCls = isBOS ? 'text-amber-800' : 'text-blue-800'
        const linkCls = isBOS ? 'text-amber-600 hover:text-amber-800' : 'text-blue-600 hover:text-blue-800'
        return (
          <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
            <div className={`${headerCls} px-5 py-3 flex items-center justify-between`}>
              <h2 className={`text-sm font-semibold ${titleCls}`}>
                {isBOS ? 'Bill of Supply' : 'Tax Invoice'} — Linked Document
              </h2>
              <Link
                href={`/invoices/${linkedInvoice.id}`}
                className={`text-xs font-mono font-semibold transition-colors ${linkCls}`}
              >
                {linkedInvoice.invoice_no} →
              </Link>
            </div>
            {/* Mobile: item cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {linkedItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900">{item.product_name}</p>
                    {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity} · ₹{round2(item.rate).toFixed(2)}</p>
                  </div>
                  <p className="font-bold text-sm text-slate-900 tabular-nums shrink-0">₹{round2(item.total).toFixed(2)}</p>
                </div>
              ))}
              <div className="px-4 py-2.5 flex justify-between bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
                <span className="font-bold text-sm text-slate-900">₹{round2(linkedInvoice.grand_total).toFixed(2)}</span>
              </div>
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linkedItems.map((item, i) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">{item.product_name}</p>
                        {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                        {item.serial_number && <p className="text-xs text-slate-400 font-mono">S/N: {item.serial_number}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">₹{round2(item.rate).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{round2(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">₹{round2(linkedInvoice.grand_total).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Payment History */}
      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Payment History</h2>
        </div>
        <div className="p-5">
          <RecordPaymentDialog
            invoiceId={invoice.id}
            grandTotal={invoice.grand_total}
            amountPaid={invoice.amount_paid}
            payments={payments}
            invoiceStatus={invoice.status}
          />
        </div>
      </div>

      <ThermalReceipt invoice={invoice} />
    </div>
  )
}
