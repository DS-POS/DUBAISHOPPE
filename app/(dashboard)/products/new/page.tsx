import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { ProductForm } from '@/components/products/ProductForm'
import { getCategories } from '@/actions/categories'

export default async function NewProductPage() {
  const categories = await getCategories()

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Back nav */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Products
      </Link>

      <div>
        <h1
          className="text-2xl font-bold text-[#0F172A]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          Add Product
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fill in the details below to add a new product to your inventory
        </p>
      </div>

      <ProductForm mode="create" categories={categories} />
    </div>
  )
}
