import Link from 'next/link'
import { format } from 'date-fns'
import { getPurchaseOrders } from '@/actions/purchase-orders'
import type { POStatus } from '@/types/database'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const STATUS_STYLE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default async function PurchaseOrdersPage() {
  const orders = await getPurchaseOrders()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchase-orders/new" className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
          + New PO
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 font-medium">No purchase orders yet.</p>
          <Link href="/purchase-orders/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create your first purchase order →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111827]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">PO No</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Supplier</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wide hidden sm:table-cell">Created</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-900">{po.po_no}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{po.supplier_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[po.status]}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">₹{formatINR(po.total_amount)}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">{format(new Date(po.created_at), 'd MMM yyyy')}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/purchase-orders/${po.id}`} className="text-xs text-blue-600 hover:underline font-medium">View</Link>
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
