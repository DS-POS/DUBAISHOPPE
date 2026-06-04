import { getExpenseCategories } from '@/actions/expenses'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'

export default async function NewExpensePage() {
  const categories = await getExpenseCategories()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add Expense</h1>
        <p className="text-sm text-slate-500 mt-0.5">Record a business expense</p>
      </div>
      <ExpenseForm categories={categories} />
    </div>
  )
}
