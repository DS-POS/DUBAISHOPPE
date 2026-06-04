import { getProducts } from '@/actions/products'
import { getCustomers } from '@/actions/customers'
import { getSettings } from '@/actions/settings'
import QuotationForm from '@/components/quotations/QuotationForm'

export default async function NewQuotationPage() {
  const [products, customers, settings] = await Promise.all([
    getProducts({ status: 'active' }),
    getCustomers(),
    getSettings(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-2xl font-bold text-[#111827]"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          New Quotation
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Build the quote — no payment, no serial required
        </p>
      </div>
      <QuotationForm products={products} customers={customers} settings={settings} />
    </div>
  )
}
