import { getCustomers } from '@/actions/customers'
import CustomerList from '@/components/customers/CustomerList'

export default async function CustomersPage() {
  const customers = await getCustomers()
  return <CustomerList initialCustomers={customers} />
}
