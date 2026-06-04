import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getCustomerById, getCustomerInvoices, getCustomerCreditSummary } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import type { InvoiceStatus } from '@/types/database'

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
}

interface Props {
  params: { id: string }
}

export default async function CustomerDetailPage({ params }: Props) {
  const [customer, invoices] = await Promise.all([
    getCustomerById(params.id),
    getCustomerInvoices(params.id).catch(() => []),
  ])

  if (!customer) notFound()

  const creditSummary = (customer.credit_limit ?? 0) > 0
    ? await getCustomerCreditSummary(customer.id)
    : null

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {customer.name}
          </h1>
          {customer.business_name && (
            <p className="text-slate-500 text-sm mt-0.5">{customer.business_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/customers">
            <Button variant="outline" size="sm">← Back</Button>
          </Link>
          <Link href={`/customers/${customer.id}/edit`}>
            <Button size="sm">Edit</Button>
          </Link>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        {customer.phone && (
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">{customer.phone}</p>
          </div>
        )}
        {customer.email && (
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium break-all">{customer.email}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">State</p>
          <p className="font-medium">{customer.state}</p>
        </div>
        {customer.gstin && (
          <div>
            <p className="text-xs text-muted-foreground">GSTIN</p>
            <p className="font-medium font-mono text-xs">{customer.gstin}</p>
          </div>
        )}
        {customer.address && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-muted-foreground">Address</p>
            <p className="font-medium">{customer.address}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Customer Since</p>
          <p className="font-medium">{format(parseISO(customer.created_at), 'dd MMM yyyy')}</p>
        </div>
      </div>

      {/* Credit Account */}
      {creditSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Credit Account</h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-slate-500">Credit Limit</p>
              <p className="text-lg font-bold text-slate-900">₹{creditSummary.credit_limit.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Outstanding</p>
              <p className={`text-lg font-bold ${creditSummary.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                ₹{creditSummary.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Available</p>
              <p className={`text-lg font-bold ${creditSummary.available_credit <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                ₹{creditSummary.available_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                creditSummary.outstanding >= creditSummary.credit_limit ? 'bg-red-500' :
                creditSummary.outstanding > creditSummary.credit_limit * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, creditSummary.credit_limit > 0 ? (creditSummary.outstanding / creditSummary.credit_limit) * 100 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {creditSummary.credit_limit > 0
              ? `${((creditSummary.outstanding / creditSummary.credit_limit) * 100).toFixed(0)}% of credit limit used`
              : 'No credit limit set'}
          </p>
        </div>
      )}

      {/* Invoice History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Invoice History
          {invoices.length > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">({invoices.length})</span>
          )}
        </h2>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No invoices yet for this customer.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Invoice No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                  <th className="px-4 py-2 text-right text-xs font-medium">Grand Total</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium hidden sm:table-cell">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-xs font-mono font-medium">
                      <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                        {inv.invoice_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {format(parseISO(inv.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2 text-right text-xs font-medium">
                      ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[inv.status as InvoiceStatus]}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground capitalize hidden sm:table-cell">
                      {inv.payment_method ? inv.payment_method.replace('_', ' ') : '—'}
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
