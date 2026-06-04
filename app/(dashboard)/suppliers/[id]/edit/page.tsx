import { notFound } from 'next/navigation'
import SupplierForm from '@/components/suppliers/SupplierForm'
import { getSupplierById } from '@/actions/suppliers'

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const supplier = await getSupplierById(params.id)
  if (!supplier) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Edit Supplier
        </h1>
        <p className="text-slate-500 text-sm mt-1">{supplier.name}</p>
      </div>
      <SupplierForm supplier={supplier} />
    </div>
  )
}
