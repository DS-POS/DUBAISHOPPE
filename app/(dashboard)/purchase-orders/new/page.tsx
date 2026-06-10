import { getProducts } from '@/actions/products'
import { getSuppliers } from '@/actions/suppliers'
import { POForm } from '@/components/purchase-orders/POForm'

export default async function NewPurchaseOrderPage() {
  const [allProducts, suppliers] = await Promise.all([
    getProducts({ status: 'active' }).catch(() => []),
    getSuppliers().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Purchase Order</h1>
        <p className="text-slate-500 text-sm mt-1">Create a purchase order to send to a supplier.</p>
      </div>
      <POForm
        products={(allProducts as Array<{ id: string; name: string; sku: string; cost_price: number }>).map(p => ({ id: p.id, name: p.name, sku: p.sku, cost_price: p.cost_price }))}
        suppliers={suppliers.map(s => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
