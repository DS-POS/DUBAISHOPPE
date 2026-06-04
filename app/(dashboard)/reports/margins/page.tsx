import { getProductMargins } from '@/actions/reports-financial'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'

interface Props { searchParams: Promise<{ from?: string; to?: string }> }

export default async function MarginsPage({ searchParams }: Props) {
  const { from, to } = await searchParams
  const now = new Date()
  const fromDate = from ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const toDate = to ?? now.toISOString().slice(0,10)
  const margins = await getProductMargins(fromDate, toDate)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Product Margins</h1><p className="text-sm text-slate-500 mt-0.5">{fromDate} to {toDate}</p></div>
        <DateRangeFilter basePath="/reports/margins" />
      </div>
      {margins.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center"><p className="font-semibold text-slate-600">No sales in this period</p></div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">COGS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Gross Profit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {margins.map(row => (
                <tr key={row.product_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{row.product_name}</p><p className="text-xs text-slate-400">{row.sku}</p></td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.qty_sold}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{row.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right text-red-600">₹{row.cogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{row.gross_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.margin_pct >= 20 ? 'bg-emerald-100 text-emerald-700' : row.margin_pct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{row.margin_pct.toFixed(1)}%</span>
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
