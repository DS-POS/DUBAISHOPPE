import Link from 'next/link'
import { getInvoices } from '@/actions/invoices'
import { format } from 'date-fns'

export default async function InvoicesPage() {
  const invoices = await getInvoices({ limit: 100 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Invoices
        </h1>
        <p className="text-slate-500 text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Link href="/billing" className="mt-4 inline-block text-sm text-primary hover:underline">
            Start billing →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-primary hover:underline">
                      {inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.customers?.name ?? 'Walk-in'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(inv.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-full">
                      {inv.payment_method ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₹{inv.grand_total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inv.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : inv.status === 'cancelled'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
