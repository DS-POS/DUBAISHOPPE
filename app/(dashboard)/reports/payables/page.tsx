import { getPayablesAging } from '@/actions/supplier-invoices'
import Link from 'next/link'

const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default async function PayablesPage() {
  const aging = await getPayablesAging()
  const totals = { current: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total_due: 0 }
  aging.forEach(a => { totals.current += a.current; totals.days_31_60 += a.days_31_60; totals.days_61_90 += a.days_61_90; totals.over_90 += a.over_90; totals.total_due += a.total_due })

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Accounts Payable</h1><p className="text-sm text-slate-500 mt-0.5">Supplier outstanding balances by age</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{label:'0–30 Days',value:totals.current,color:'text-emerald-600'},{label:'31–60 Days',value:totals.days_31_60,color:'text-amber-600'},{label:'61–90 Days',value:totals.days_61_90,color:'text-orange-600'},{label:'90+ Days',value:totals.over_90,color:'text-red-600'}].map(card=>(
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>
      {aging.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center"><p className="font-semibold text-slate-600">No outstanding payables</p></div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
          {/* Mobile: compact cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {aging.map(row => (
              <div key={row.supplier_name} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-slate-900 truncate min-w-0 flex-1">{row.supplier_name}</p>
                  <p className="font-bold text-sm text-red-600 tabular-nums shrink-0">{fmt(row.total_due)}</p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                  {row.current > 0 && <span className="text-emerald-600">0–30: {fmt(row.current)}</span>}
                  {row.days_31_60 > 0 && <span className="text-amber-600">31–60: {fmt(row.days_31_60)}</span>}
                  {row.days_61_90 > 0 && <span className="text-orange-600">61–90: {fmt(row.days_61_90)}</span>}
                  {row.over_90 > 0 && <span className="text-red-600">90+: {fmt(row.over_90)}</span>}
                </div>
                {row.supplier_id && (
                  <div className="mt-1.5">
                    <Link href={`/suppliers/${row.supplier_id}/ledger`} className="text-xs font-semibold text-slate-900 underline">Ledger →</Link>
                  </div>
                )}
              </div>
            ))}
            <div className="px-4 py-3 bg-slate-50 flex justify-between items-center">
              <span className="font-bold text-xs text-slate-700 uppercase tracking-wide">Total</span>
              <span className="font-bold text-sm text-red-600 tabular-nums">{fmt(totals.total_due)}</span>
            </div>
          </div>
          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">0–30</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">31–60</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">61–90</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">90+</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Total Due</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aging.map(row=>(
                  <tr key={row.supplier_name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.supplier_name}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(row.current)}</td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">{fmt(row.days_31_60)}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(row.days_61_90)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(row.over_90)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(row.total_due)}</td>
                    <td className="px-4 py-3">{row.supplier_id && <Link href={`/suppliers/${row.supplier_id}/ledger`} className="text-xs text-slate-900 font-medium hover:underline">Ledger →</Link>}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-3 text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmt(totals.current)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{fmt(totals.days_31_60)}</td>
                  <td className="px-4 py-3 text-right text-orange-700">{fmt(totals.days_61_90)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{fmt(totals.over_90)}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{fmt(totals.total_due)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
