'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props { basePath: string }

export function DateRangeFilter({ basePath }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const defaultTo = now.toISOString().slice(0,10)
  const from = params.get('from') ?? defaultFrom
  const to = params.get('to') ?? defaultTo

  function apply(f: string, t: string) { router.push(`${basePath}?from=${f}&to=${t}`) }

  const lastMonthStart = (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toISOString().slice(0,10) })()
  const lastMonthEnd = (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0,10) })()

  const presets = [
    { label: 'Today', f: defaultTo, t: defaultTo },
    { label: 'This Month', f: defaultFrom, t: defaultTo },
    { label: 'Last Month', f: lastMonthStart, t: lastMonthEnd },
    { label: 'This Year', f: `${now.getFullYear()}-01-01`, t: defaultTo },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(p => (
        <button key={p.label} onClick={() => apply(p.f, p.t)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${from===p.f&&to===p.t ? 'bg-[#111827] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-1">
        <input type="date" value={from} onChange={e => apply(e.target.value, to)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={to} onChange={e => apply(from, e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-[#111827]/20" />
      </div>
    </div>
  )
}
