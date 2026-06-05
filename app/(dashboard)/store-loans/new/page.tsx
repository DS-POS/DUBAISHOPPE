import { StoreLoanForm } from '@/components/store-loans/StoreLoanForm'

export default function NewStoreLoanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Loan</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track an item lent to or borrowed from another store</p>
      </div>
      <StoreLoanForm />
    </div>
  )
}
