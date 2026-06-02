import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSupplierInvoice } from '@/actions/supplier-invoices'
import { deleteSupplierPayment } from '@/actions/supplier-payments'
import { AddPaymentDialog } from '@/components/stock-in/AddPaymentDialog'
import { Button } from '@/components/ui/button'
import type { SupplierPayment } from '@/types/database'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
}

interface Props {
  params: { id: string }
}

async function DeletePaymentButton({ paymentId, invoiceId }: { paymentId: string; invoiceId: string }) {
  async function handleDelete() {
    'use server'
    await deleteSupplierPayment(paymentId, invoiceId)
  }
  return (
    <form action={handleDelete}>
      <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
        Delete
      </button>
    </form>
  )
}

export default async function SupplierInvoiceDetailPage({ params }: Props) {
  const invoice = await getSupplierInvoice(params.id)
  if (!invoice) notFound()

  const payments = invoice.supplier_payments ?? []
  const stockItems = invoice.stock_in ?? []
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = Number(invoice.total_amount) - totalPaid

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
              {invoice.purchase_invoice_no ?? 'Invoice'}
            </h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[invoice.payment_status]}`}>
              {invoice.payment_status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {invoice.supplier_name ?? 'Unknown Supplier'}
            {invoice.supplier_gstin && <span className="ml-2 font-mono text-xs">{invoice.supplier_gstin}</span>}
          </p>
        </div>
        <Link href="/stock-in">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      {/* Invoice Summary */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Purchase Date</p>
          <p className="font-medium">{format(parseISO(invoice.purchase_date), 'dd MMM yyyy')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="font-medium">₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Amount Paid</p>
          <p className="font-medium text-emerald-600">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Balance Due</p>
          <p className={`font-medium ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Stock Items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{stockItems.length} Item{stockItems.length !== 1 ? 's' : ''} Received</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium">Product</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Cost Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockItems.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-xs">{item.products?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{item.products?.sku}</p>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-xs">₹{Number(item.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-xs font-medium">
                    ₹{(item.quantity * Number(item.cost_price)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Payment History</h2>
          {balance > 0 && (
            <AddPaymentDialog invoiceId={invoice.id} balance={balance} />
          )}
        </div>

        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Method</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Reference</th>
                  <th className="px-4 py-2 text-right text-xs font-medium">Amount</th>
                  <th className="px-4 py-2 text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: SupplierPayment) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-xs">{format(parseISO(p.payment_date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-2 text-xs capitalize">{p.payment_method ?? '—'}</td>
                    <td className="px-4 py-2 text-xs font-mono">{p.payment_reference ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium text-emerald-600">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeletePaymentButton paymentId={p.id} invoiceId={invoice.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
