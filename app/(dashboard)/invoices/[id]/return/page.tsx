import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/actions/invoices'
import { getReturnableItems } from '@/actions/sales-returns'
import { ReturnForm } from '@/components/sales-returns/ReturnForm'

export default async function InvoiceReturnPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id)
  if (!invoice) notFound()

  if (invoice.status === 'cancelled') {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-red-600 font-medium">Cannot process return — invoice is cancelled.</p>
        <Link href={`/invoices/${params.id}`} className="text-sm text-blue-600 hover:underline">← Back to Invoice</Link>
      </div>
    )
  }

  const returnableItems = await getReturnableItems(params.id)

  if (returnableItems.length === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-[#111827]">Process Return</h1>
        <p className="text-slate-600">All items on invoice <strong>{invoice.invoice_no}</strong> have already been returned.</p>
        <Link href={`/invoices/${params.id}`} className="text-sm text-blue-600 hover:underline">← Back to Invoice</Link>
      </div>
    )
  }

  const customerState = invoice.customers?.state ?? 'Telangana'

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/invoices/${params.id}`} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
          ← {invoice.invoice_no}
        </Link>
        <h1 className="text-2xl font-bold text-[#111827]">Process Return</h1>
        <p className="text-slate-500 text-sm mt-1">Select items to return from invoice {invoice.invoice_no}</p>
      </div>
      <ReturnForm
        invoiceId={params.id}
        invoiceNo={invoice.invoice_no}
        customerState={customerState}
        items={returnableItems}
      />
    </div>
  )
}
