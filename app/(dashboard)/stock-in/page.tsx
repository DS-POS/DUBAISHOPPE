import Link from 'next/link'
import { getStockIns } from '@/actions/stock-in'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'

export default async function StockInPage() {
  const records = await getStockIns({ limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#0F172A]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            Stock In
          </h1>
          <p className="text-slate-500 text-sm mt-1">Receive inventory into your store</p>
        </div>
        <Link href="/stock-in/new">
          <Button>+ Add Stock</Button>
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 text-sm">No stock received yet.</p>
          <Link href="/stock-in/new" className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              Add First Stock Entry
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Product</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Qty</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Cost Price</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Supplier</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Invoice No</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    {record.products?.name ?? '—'}
                    <span className="block text-xs text-slate-400">{record.products?.sku ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{record.quantity}</td>
                  <td className="px-4 py-3 tabular-nums">
                    ₹{Number(record.cost_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{record.supplier_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {record.purchase_invoice_no ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {format(parseISO(record.purchase_date), 'dd MMM yyyy')}
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
