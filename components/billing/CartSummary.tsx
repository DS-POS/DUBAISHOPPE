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
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
        <span>₹{round2(subtotal).toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="text-emerald-600">−₹{round2(discount).toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between text-muted-foreground">
        <span>Taxable Amount</span>
        <span>₹{round2(taxable_amount).toFixed(2)}</span>
      </div>
      {isIGST ? (
        <div className="flex justify-between text-muted-foreground">
          <span>IGST</span>
          <span>₹{round2(igst).toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-muted-foreground">
            <span>CGST</span>
            <span>₹{round2(cgst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>SGST</span>
            <span>₹{round2(sgst).toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
        <span>Grand Total</span>
        <span>₹{round2(grand_total).toFixed(2)}</span>
      </div>
    </div>
  )
}
