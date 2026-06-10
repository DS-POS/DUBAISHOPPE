import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { getProducts } from '@/actions/products'
import { StockAdjustmentForm } from '@/components/stock-adjustments/StockAdjustmentForm'

export default async function NewStockAdjustmentPage() {
  const products = await getProducts({ status: 'active' })

  return (
    <div className="space-y-5">
      <div>
        <Link href="/stock-adjustments"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="size-3.5" /> Stock Adjustments
        </Link>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
          New Stock Adjustment
        </h1>
        <p className="text-slate-500 text-sm mt-1">Correct stock levels for damages, returns, or manual corrections</p>
      </div>
      <StockAdjustmentForm products={products} />
    </div>
  )
}
