'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUpIcon } from 'lucide-react'
import type { DailyRevenuePoint } from '@/actions/invoices'

interface Props {
  data: DailyRevenuePoint[]
  totalRevenue: number
  days: number
}

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

interface TooltipPayload { active?: boolean; payload?: Array<{ payload: DailyRevenuePoint }>; label?: string }

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      <p className="text-slate-600">Revenue: <span className="font-bold text-slate-900">₹{point.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
      <p className="text-slate-500">{point.invoices} invoice{point.invoices !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function RevenueChart({ data, totalRevenue, days }: Props) {
  const hasData = data.some(d => d.revenue > 0)
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
      {/* Colored Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <TrendingUpIcon className="size-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-tight">Revenue Trend</h2>
            <p className="text-slate-400 text-xs">Last {days} days</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{formatINR(totalRevenue)}</p>
          <p className="text-xs text-slate-400">{days}d total</p>
        </div>
      </div>

      {/* Chart Body */}
      <div className="p-4">
        {!hasData ? (
          <div className="h-20 flex items-center justify-center text-slate-400 text-sm">
            No invoices in the last {days} days.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111827" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatINR} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#111827" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: '#111827' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
