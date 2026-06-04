import { getProfitLoss } from '@/actions/reports-financial'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'

interface Props { searchParams: Promise<{ from?: string; to?: string }> }

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const pct = (n: number) => `${n.toFixed(1)}%`

export default async function ProfitLossPage({ searchParams }: Props) {
  const { from, to } = await searchParams
  const now = new Date()
  const fromDate = from ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const toDate = to ?? now.toISOString().slice(0,10)
  const report = await getProfitLoss(fromDate, toDate)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Profit &amp; Loss</h1><p className="text-sm text-slate-500 mt-0.5">{fromDate} to {toDate}</p></div>
        <DateRangeFilter basePath="/reports/profit-loss" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Net Revenue', value: fmt(report.net_revenue), color: 'text-slate-900' },
          { label: 'Gross Profit', value: fmt(report.gross_profit), color: report.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Total Expenses', value: fmt(report.total_expenses), color: 'text-red-600' },
          { label: 'Net Profit', value: fmt(report.net_profit), color: report.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 ring-1 ring-black/[0.06] shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-black mt-0.5 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm overflow-hidden max-w-xl">
        <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Income Statement</h2></div>
        <div className="divide-y divide-slate-100">
          {[
            { section: 'REVENUE', rows: [
              { label: 'Gross Revenue', val: fmt(report.gross_revenue) },
              { label: 'Less: Sales Returns', val: `(${fmt(report.returns_total)})`, red: true },
              { label: 'Net Revenue', val: fmt(report.net_revenue), bold: true },
            ]},
            { section: 'COST OF GOODS', rows: [
              { label: 'Cost of Goods Sold', val: `(${fmt(report.cogs)})`, red: true },
              { label: `Gross Profit (${pct(report.gross_margin_pct)})`, val: fmt(report.gross_profit), bold: true, green: report.gross_profit >= 0 },
            ]},
            { section: 'OPERATING EXPENSES', rows: [
              ...report.expenses_by_category.map(e => ({ label: e.category, val: `(${fmt(e.amount)})`, red: true })),
              { label: 'Total Expenses', val: `(${fmt(report.total_expenses)})`, bold: true, red: true },
            ]},
            { section: 'NET PROFIT', rows: [
              { label: `Net Profit (${pct(report.net_margin_pct)})`, val: fmt(report.net_profit), bold: true, green: report.net_profit >= 0, bigRed: report.net_profit < 0 },
            ]},
          ].map(s => (
            <div key={s.section}>
              <div className="px-5 py-2 bg-slate-50"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.section}</span></div>
              {s.rows.map((row, i) => (
                <div key={i} className="flex justify-between items-center px-5 py-2.5">
                  <span className={`text-sm ${(row as {bold?:boolean}).bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{row.label}</span>
                  <span className={`text-sm font-medium ${(row as {red?:boolean}).red ? 'text-red-600' : (row as {green?:boolean}).green ? 'text-emerald-600' : (row as {bigRed?:boolean}).bigRed ? 'text-red-600' : 'text-slate-900'} ${(row as {bold?:boolean}).bold ? 'font-bold' : ''}`}>{row.val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
