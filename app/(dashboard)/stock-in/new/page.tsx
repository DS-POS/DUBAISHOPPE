import { getProducts } from '@/actions/products'
import StockInForm from '@/components/stock-in/StockInForm'

export default async function NewStockInPage() {
  const products = await getProducts({ status: 'active' })

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#0F172A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Add Stock
        </h1>
        <p className="text-slate-500 text-sm mt-1">Record new inventory received</p>
      </div>
      <StockInForm products={products} />
    </div>
  )
}
