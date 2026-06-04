import { getProducts } from '@/actions/products'
import { getCustomers } from '@/actions/customers'
import BillingForm from '@/components/billing/BillingForm'
import dynamic from 'next/dynamic'

const CachePopulator = dynamic(() => import('@/components/offline/CachePopulator').then(m => m.CachePopulator), { ssr: false })

export default async function BillingPage() {
  const [products, customers] = await Promise.all([
    getProducts({ status: 'active' }),
    getCustomers(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          New Sale
        </h1>
        <p className="text-slate-500 text-sm mt-1">Scan or search products to build the cart</p>
      </div>
      {/* Silently cache products + customers in Dexie for offline billing */}
      <CachePopulator products={products} customers={customers} />
      <BillingForm products={products} customers={customers} />
    </div>
  )
}
