import { notFound } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import { getCustomerById } from '@/actions/customers'

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const customer = await getCustomerById(params.id)
  if (!customer) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Edit Customer
        </h1>
        <p className="text-slate-500 text-sm mt-1">{customer.name}</p>
      </div>
      <CustomerForm customer={customer} />
    </div>
  )
}
