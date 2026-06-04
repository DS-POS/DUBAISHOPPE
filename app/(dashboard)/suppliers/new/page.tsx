import SupplierForm from '@/components/suppliers/SupplierForm'

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Add Supplier
        </h1>
        <p className="text-slate-500 text-sm mt-1">Add a new supplier record</p>
      </div>
      <SupplierForm />
    </div>
  )
}
