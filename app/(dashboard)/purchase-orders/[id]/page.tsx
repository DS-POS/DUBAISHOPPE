import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getPurchaseOrder } from '@/actions/purchase-orders'
import { PODetailActions } from '@/components/purchase-orders/PODetailActions'
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

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const po = await getPurchaseOrder(params.id)
  if (!po) notFound()

  const items = po.purchase_order_items ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/purchase-orders" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">← Purchase Orders</Link>
          <h1 className="text-2xl font-bold text-[#111827]">{po.po_no}</h1>
          <p className="text-slate-500 text-sm mt-1">{format(new Date(po.created_at), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_STYLE[po.status]}`}>{po.status}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Supplier</span>
          <span className="font-semibold text-slate-900">{po.supplier_name ?? '—'}</span>
        </div>
        {po.expected_date && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Expected Date</span>
            <span className="font-medium text-slate-900">{format(new Date(po.expected_date), 'dd MMM yyyy')}</span>
          </div>
        )}
        {po.notes && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Notes</span>
            <span className="text-slate-700">{po.notes}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Unit Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{item.quantity_ordered}</td>
                <td className="px-4 py-3 text-right text-slate-700">₹{formatINR(item.unit_cost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{formatINR(item.total_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Total</td>
              <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">₹{formatINR(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PODetailActions po={{ id: po.id, status: po.status, po_no: po.po_no }} />
    </div>
  )
}
