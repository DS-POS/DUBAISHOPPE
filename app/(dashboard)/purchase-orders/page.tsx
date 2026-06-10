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
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchase-orders/new" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
          + New PO
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-slate-400">📋</span>
          </div>
          <p className="font-semibold text-slate-700">No purchase orders yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first purchase order to get started</p>
          <Link href="/purchase-orders/new" className="text-blue-600 hover:underline text-sm mt-3 inline-block font-medium">Create purchase order →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">PO No</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">Created</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
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
