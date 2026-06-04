import { getProducts } from '@/actions/products'
import { ProductBulkImport } from '@/components/products/ProductBulkImport'

export const dynamic = 'force-dynamic'

export default async function ImportProductsPage() {
  const products = await getProducts()
  const existingSkusArr = products.map(p => p.sku)

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#111827]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Import Products
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Bulk import products from Excel or CSV
        </p>
      </div>
      <ProductBulkImport existingSkusArr={existingSkusArr} />
    </div>
  )
}
