import { getProducts } from '@/actions/products'
import StockInForm from '@/components/stock-in/StockInForm'

export default async function NewStockInPage() {
  const products = await getProducts({ status: 'active' })

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#111827]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          New Supplier Invoice
        </h1>
        <p className="text-slate-500 text-sm mt-1">Enter supplier details and items manually</p>
      </div>
      <StockInForm products={products} />
    </div>
  )
}
