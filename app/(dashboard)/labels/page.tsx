import { getProducts } from '@/actions/products'
import { LabelPrinter } from '@/components/products/LabelPrinter'

export default async function LabelsPage() {
  const products = await getProducts({ status: 'active' })

  return <LabelPrinter products={products} />
}
