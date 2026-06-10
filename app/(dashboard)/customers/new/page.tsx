import CustomerForm from '@/components/customers/CustomerForm'

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Add Customer
        </h1>
        <p className="text-slate-500 text-sm mt-1">Add a new customer record</p>
      </div>
      <CustomerForm />
    </div>
  )
}
