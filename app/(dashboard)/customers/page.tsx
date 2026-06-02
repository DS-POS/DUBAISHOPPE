import Link from 'next/link'
import { getCustomers } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            Customers
          </h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/customers/new">
          <Button><PlusIcon className="size-4 mr-2" />Add Customer</Button>
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No customers yet.</p>
          <Link href="/customers/new">
            <Button className="mt-4">Add First Customer</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">State</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">GSTIN</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.state}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.gstin ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}/edit`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
