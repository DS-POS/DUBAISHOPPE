import { getAllInvoices } from '@/actions/invoices'
import InvoiceList from '@/components/invoices/InvoiceList'

export default async function InvoicesPage() {
  const invoices = await getAllInvoices()
  return <InvoiceList initialInvoices={invoices} />
}
