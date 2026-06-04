import { round2 } from '@/lib/gst'

interface CartSummaryProps {
  subtotal: number
  discount: number
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_gst: number
  grand_total: number
  itemCount: number
}

export function CartSummary({
  subtotal, discount, taxable_amount, cgst, sgst, igst, grand_total, itemCount
}: CartSummaryProps) {
  const isIGST = igst > 0

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm p-5 space-y-2.5 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-slate-500">Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
        <span className="font-medium text-slate-700">₹{round2(subtotal).toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Discount</span>
          <span className="font-semibold text-emerald-600">−₹{round2(discount).toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-slate-500">Taxable Amount</span>
        <span className="font-medium text-slate-700">₹{round2(taxable_amount).toFixed(2)}</span>
      </div>
      {isIGST ? (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">IGST</span>
          <span className="font-medium text-slate-700">₹{round2(igst).toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">CGST</span>
            <span className="font-medium text-slate-700">₹{round2(cgst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">SGST</span>
            <span className="font-medium text-slate-700">₹{round2(sgst).toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="h-px bg-slate-100 my-1" />
      <div className="flex justify-between items-center">
        <span className="font-bold text-slate-900 text-base">Grand Total</span>
        <span className="font-black text-[#111827] text-xl">₹{round2(grand_total).toFixed(2)}</span>
      </div>
    </div>
  )
}
