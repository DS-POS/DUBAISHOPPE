import { getProducts, getCategories } from '@/actions/products'
import { InvoiceBulkImport } from '@/components/stock-in/InvoiceBulkImport'

export default async function ImportInvoicePage() {
  const [products, categories] = await Promise.all([
    getProducts({ status: 'active' }),
    getCategories(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Import Supplier Invoice
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload invoice — all items extracted automatically
        </p>
      </div>
      <InvoiceBulkImport products={products} categories={categories} />
    </div>
  )
}
