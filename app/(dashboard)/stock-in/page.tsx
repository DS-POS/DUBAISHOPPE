import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSupplierInvoices } from '@/actions/supplier-invoices'
import { getStockIns } from '@/actions/stock-in'
import { Button } from '@/components/ui/button'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
}

export default async function StockInPage() {
  const [invoices, manualEntries] = await Promise.all([
    getSupplierInvoices(),
    getStockIns({ limit: 50 }),
  ])

  const manualOnly = manualEntries.filter(r => !r.supplier_invoice_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Stock In
          </h1>
          <p className="text-slate-500 text-sm mt-1">Supplier invoices and stock received</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-in/new">
            <Button variant="outline" size="sm">+ Manual Entry</Button>
          </Link>
          <Link href="/stock-in/import">
            <Button size="sm">↑ Import Invoice</Button>
          </Link>
        </div>
      </div>

      {/* Supplier Invoices */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Supplier Invoices</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No supplier invoices imported yet.{' '}
            <Link href="/stock-in/import" className="text-primary underline">Import one</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium">Invoice No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium">Status</th>
                  <th className="px-4 py-3 text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => {
                  const paid = (inv.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
                  const balance = Number(inv.total_amount) - paid
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-xs">
                        {inv.purchase_invoice_no ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {inv.supplier_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(parseISO(inv.purchase_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        <div>₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        {balance > 0 && (
                          <div className="text-red-500">Due: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[inv.payment_status]}`}>
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/stock-in/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7">View →</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Stock Entries */}
      {manualOnly.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Manual Stock Entries</h2>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Cost</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualOnly.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-medium">
                      {r.products?.name ?? '—'}
                      <span className="block text-slate-400">{r.products?.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{r.quantity}</td>
                    <td className="px-4 py-2 text-xs">₹{Number(r.cost_price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {format(parseISO(r.purchase_date), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
