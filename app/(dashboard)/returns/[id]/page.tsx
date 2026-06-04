import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getSalesReturn } from '@/actions/sales-returns'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const REFUND_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card',
  bank_transfer: 'Bank Transfer', store_credit: 'Store Credit', no_refund: 'No Refund / Exchange',
}

export default async function ReturnDetailPage({ params }: { params: { id: string } }) {
  const ret = await getSalesReturn(params.id)
  if (!ret) notFound()

  const items = ret.sales_return_items ?? []
  const customerName = ret.invoices?.customers?.name ?? 'Walk-in Customer'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/returns" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">← Returns</Link>
          <h1 className="text-2xl font-bold text-[#111827]">{ret.return_no}</h1>
          <p className="text-slate-500 text-sm mt-1">{format(new Date(ret.created_at), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
        <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          {REFUND_LABELS[ret.refund_method] ?? ret.refund_method}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice</span>
          <Link href={`/invoices/${ret.invoices?.id}`} className="font-mono font-medium text-blue-600 hover:underline">
            {ret.invoices?.invoice_no}
          </Link>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Customer</span>
          <span className="font-medium text-slate-900">{customerName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Reason</span>
          <span className="font-medium text-slate-900 text-right max-w-xs">{ret.reason}</span>
        </div>
        {ret.notes && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Notes</span>
            <span className="text-slate-700 text-right max-w-xs">{ret.notes}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Rate</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  {item.serial_number && <p className="text-xs text-slate-400">S/N: {item.serial_number}</p>}
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{item.quantity_returned}</td>
                <td className="px-4 py-3 text-right text-slate-700">₹{formatINR(item.rate)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{formatINR(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Total Refund</td>
              <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">₹{formatINR(ret.total_refund)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
