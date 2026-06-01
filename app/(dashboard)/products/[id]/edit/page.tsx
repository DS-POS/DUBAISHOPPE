import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { ProductForm } from '@/components/products/ProductForm'
import { getProduct } from '@/actions/products'
import { getCategories } from '@/actions/categories'

interface EditProductPageProps {
  params: { id: string }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const [product, categories] = await Promise.all([
    getProduct(params.id),
    getCategories(),
  ])

  if (!product) notFound()

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
          Edit Product
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Editing: <span className="font-medium text-foreground">{product.name}</span>
        </p>
      </div>

      <ProductForm mode="edit" product={product} categories={categories} />
    </div>
  )
}
