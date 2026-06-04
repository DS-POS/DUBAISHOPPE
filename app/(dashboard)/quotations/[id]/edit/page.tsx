import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { getQuotation } from '@/actions/quotations'
import { getProducts } from '@/actions/products'
import { getCustomers } from '@/actions/customers'
import { getSettings } from '@/actions/settings'
import QuotationForm from '@/components/quotations/QuotationForm'

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [quotation, products, customers, settings] = await Promise.all([
    getQuotation(id),
    getProducts({ status: 'active' }),
    getCustomers(),
    getSettings(),
  ])
  if (!quotation) notFound()
  if (quotation.status !== 'draft') {
    return (
      <div className="space-y-4">
        <Link href={`/quotations/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeftIcon className="size-3.5" /> Back
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">Cannot edit this quotation</p>
          <p className="text-sm text-red-600 mt-1">Only draft quotations can be edited. This quotation is <strong>{quotation.status}</strong>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/quotations/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="size-3.5" /> {quotation.quotation_no}
        </Link>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Edit Quotation
        </h1>
        <p className="text-slate-500 text-sm mt-1">{quotation.quotation_no}</p>
      </div>
      <QuotationForm
        products={products}
        customers={customers}
        settings={settings}
        initialQuotation={{
          id: quotation.id,
          customer_id: quotation.customer_id,
          customer: quotation.customers ?? null,
          quotation_date: quotation.quotation_date,
          valid_until: quotation.valid_until,
          notes: quotation.notes,
          selected_bank_index: quotation.selected_bank_index,
          items: quotation.quotation_items ?? [],
        }}
      />
    </div>
  )
}
