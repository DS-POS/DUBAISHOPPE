import { round2 } from '@/lib/gst'
import type { NonTaxableLineItem } from './types'

interface CartSummaryProps {
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  itemCount: number
  discount: number
  non_taxable_items: NonTaxableLineItem[]
}

export function CartSummary({
  taxable_amount, cgst, sgst, igst, grand_total, itemCount, discount, non_taxable_items
}: CartSummaryProps) {
  const isIGST = igst > 0
  const hasNonTaxable = non_taxable_items.length > 0
  const hasTaxable = taxable_amount > 0

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-5 space-y-2.5 text-sm">
      {discount > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">Discount</span>
          <span className="text-sm font-bold text-emerald-600">−₹{round2(discount).toFixed(2)}</span>
        </div>
      )}
      {hasTaxable && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">Taxable Amount</span>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">₹{round2(taxable_amount).toFixed(2)}</span>
        </div>
      )}
      {hasTaxable && (isIGST ? (
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">IGST</span>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">₹{round2(igst).toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500 font-medium">CGST</span>
            <span className="text-sm font-semibold text-slate-700 tabular-nums">₹{round2(cgst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500 font-medium">SGST</span>
            <span className="text-sm font-semibold text-slate-700 tabular-nums">₹{round2(sgst).toFixed(2)}</span>
          </div>
        </>
      ))}
      {hasNonTaxable && non_taxable_items.map((item, idx) => (
        <div key={idx} className="flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium truncate max-w-[180px]">
            {item.name}{item.qty > 1 ? ` ×${item.qty}` : ''}
          </span>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">₹{round2(item.total).toFixed(2)}</span>
        </div>
      ))}
      <div className="flex justify-between items-center bg-slate-50 -mx-5 px-5 py-3 -mb-5 rounded-b-2xl mt-2">
        <span className="font-bold text-slate-900 text-base">
          Grand Total <span className="text-sm font-normal text-slate-400">({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
        </span>
        <span className="font-black text-slate-900 text-2xl tabular-nums">₹{round2(grand_total).toFixed(2)}</span>
      </div>
    </div>
  )
}
