import { getDayEndSummary } from '@/actions/reports-financial'

interface Props { searchParams: Promise<{ date?: string }> }

export default async function DayEndPage({ searchParams }: Props) {
  const { date } = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const reportDate = date ?? today
  const summary = await getDayEndSummary(reportDate)
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Day-End Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date(reportDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>
        </div>
        <form><input type="date" name="date" defaultValue={reportDate} onChange={e => { if(e.target.value) window.location.href=`/reports/day-end?date=${e.target.value}` }} className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none" /></form>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Invoices', value: `${summary.sales_count}`, sub: fmt(summary.gross_sales), color: 'text-slate-900' },
          { label: 'Returns', value: `${summary.returns_count}`, sub: fmt(summary.returns_total), color: 'text-red-600' },
          { label: 'Net Sales', value: fmt(summary.net_sales), sub: '', color: 'text-emerald-600' },
          { label: 'Cash Collected', value: fmt(summary.cash_collected), sub: '', color: 'text-blue-600' },
          { label: 'Expenses', value: fmt(summary.expenses_total), sub: '', color: 'text-red-600' },
          { label: 'Net Cash', value: fmt(summary.net_cash), sub: '', color: summary.net_cash >= 0 ? 'text-emerald-700' : 'text-red-700' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-black mt-0.5 ${card.color}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>
      {summary.payments_by_method.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Payments Received by Method</h2>
          <div className="space-y-2">
            {summary.payments_by_method.map(p => (
              <div key={p.method} className="flex justify-between text-sm">
                <span className="capitalize text-slate-600">{p.method.replace('_',' ')}</span>
                <span className="font-semibold text-slate-900">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
