import { getSuppliers } from '@/actions/suppliers'
import SupplierList from '@/components/suppliers/SupplierList'

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  return <SupplierList initialSuppliers={suppliers} />
}
