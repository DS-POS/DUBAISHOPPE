import { StoreLoanForm } from '@/components/store-loans/StoreLoanForm'
import { getProducts } from '@/actions/products'

export default async function NewStoreLoanPage() {
  const products = await getProducts()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Loan</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track an item lent to or borrowed from another store</p>
      </div>
      <StoreLoanForm products={products} />
    </div>
  )
}
