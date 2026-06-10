'use client'

import { useState, useMemo, Fragment } from 'react'
import { format } from 'date-fns'

import { round2 } from '@/lib/gst'
import type { QuotationStatus, Quotation } from '@/types/database'
import { QuotationRowActions } from './QuotationRowActions'

type QuotationWithCustomer = Quotation & { customers: { name: string } | null }

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  expired: 'Expired',
  rejected: 'Rejected',
}

const STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
}

const STATUS_PRIORITY: QuotationStatus[] = ['accepted', 'sent', 'draft', 'expired', 'rejected']

function dominantStatus(items: QuotationWithCustomer[]): QuotationStatus {
  for (const p of STATUS_PRIORITY) {
    if (items.some(q => q.status === p)) return p
  }
  return items[0].status as QuotationStatus
}

interface Props {
  quotations: QuotationWithCustomer[]
}

export function QuotationList({ quotations }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, QuotationWithCustomer[]>()
    for (const q of quotations) {
      const key = q.customers?.name ?? 'Walk-in'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(q)
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items,
        total: items.reduce((s, q) => s + round2(q.grand_total), 0),
      }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [quotations])

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {/* Mobile: grouped collapsible cards */}
      <div className="block md:hidden divide-y divide-slate-100">
        {groups.map(group => {
          const isOpen = expanded.has(group.name)
          const status = dominantStatus(group.items)
          const initial = group.name === 'Walk-in' ? '?' : group.name[0].toUpperCase()
          return (
            <Fragment key={`mgroup-${group.name}`}>
              <div
                onClick={() => toggle(group.name)}
                className="px-4 py-3 bg-gradient-to-r from-blue-50 to-slate-50 cursor-pointer active:from-blue-100 select-none transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`text-slate-400 text-[10px] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{initial}</span>
                    </div>
                    <p className="font-bold text-sm text-slate-900 truncate">{group.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">{group.items.length} quot</span>
                    <p className="font-bold text-sm text-slate-900 tabular-nums">₹{group.total.toFixed(2)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
                  </div>
                </div>
              </div>
              {isOpen && group.items.map(q => (
                <div key={q.id} className="px-4 py-3 pl-11 bg-white border-l-2 border-blue-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-slate-900">{q.quotation_no}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{format(new Date(q.quotation_date ?? q.created_at), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="font-bold text-sm text-slate-900 tabular-nums">₹{round2(q.grand_total).toFixed(2)}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CLASSES[q.status as QuotationStatus]}`}>{STATUS_LABELS[q.status as QuotationStatus]}</span>
                    <QuotationRowActions quotationId={q.id} status={q.status} />
                  </div>
                </div>
              ))}
            </Fragment>
          )
        })}
      </div>
      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr>
              <th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                Quotations
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                Date
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                Total Value
              </th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => {
              const isOpen = expanded.has(group.name)
              const status = dominantStatus(group.items)
              const initial = group.name === 'Walk-in' ? '?' : group.name[0].toUpperCase()

              return (
                <Fragment key={`group-${group.name}`}>
                  {/* Group header row */}
                  <tr
                    onClick={() => toggle(group.name)}
                    className={`border-b border-slate-200 cursor-pointer transition-colors select-none ${
                      isOpen ? 'bg-blue-50/60' : 'bg-slate-50/80 hover:bg-slate-100/80'
                    }`}
                  >
                    {/* # */}
                    <td className="px-3 py-3 text-xs font-bold text-blue-400 text-center w-8">{gi + 1}</td>
                    {/* Count */}
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold">
                        {group.items.length} quot
                      </span>
                    </td>
                    {/* Customer */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-slate-400 text-[10px] inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initial}
                        </div>
                        <span className="font-semibold text-slate-800">{group.name}</span>
                      </div>
                    </td>
                    {/* Date — empty */}
                    <td className="px-5 py-3" />
                    {/* Total */}
                    <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      ₹{group.total.toFixed(2)}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-5 py-3" />
                  </tr>

                  {/* Detail rows */}
                  {isOpen && group.items.map((q, i) => (
                    <tr
                      key={q.id}
                      className={`border-b border-slate-100 last:border-slate-200 hover:bg-blue-50/20 transition-colors ${
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-xs text-slate-300 text-center tabular-nums">{i + 1}</td>
                      <td className="px-5 py-2.5" />
                      <td className="pl-12 pr-4 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {q.quotation_no}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(q.quotation_date ?? q.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        ₹{round2(q.grand_total).toFixed(2)}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[q.status as QuotationStatus]}`}>
                          {STATUS_LABELS[q.status as QuotationStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <QuotationRowActions quotationId={q.id} status={q.status} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

