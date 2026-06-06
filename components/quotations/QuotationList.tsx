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
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#111827] border-b border-[#1F2937]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap">
                Quotations
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap">
                Total Value
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const isOpen = expanded.has(group.name)
              const status = dominantStatus(group.items)
              const initial = group.name === 'Walk-in' ? '?' : group.name[0].toUpperCase()

              return (
                <Fragment key={`group-${group.name}`}>
                  {/* Group header row — click to expand */}
                  <tr
                    onClick={() => toggle(group.name)}
                    className={`border-b border-slate-200 cursor-pointer transition-colors select-none ${
                      isOpen ? 'bg-blue-50/60' : 'bg-slate-50/80 hover:bg-slate-100/80'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initial}
                        </div>
                        <span className="font-semibold text-slate-800">{group.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {group.items.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{group.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                        isOpen ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {group.items.length}
                      </span>
                    </td>
                  </tr>

                  {/* Detail rows — visible when expanded */}
                  {isOpen && group.items.map((q, i) => (
                    <tr
                      key={q.id}
                      className={`border-b border-slate-100 last:border-slate-200 hover:bg-blue-50/20 transition-colors ${
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <td className="pl-16 pr-4 py-2.5 font-mono font-semibold text-[#111827] whitespace-nowrap">
                        {q.quotation_no}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(q.quotation_date ?? q.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        ₹{round2(q.grand_total).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[q.status as QuotationStatus]}`}>
                          {STATUS_LABELS[q.status as QuotationStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
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
