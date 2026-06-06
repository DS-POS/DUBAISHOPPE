'use client'
import type { ReactNode } from 'react'
import { useDashboardWidgets, type WidgetId } from './useDashboardWidgets'
import { DashboardCustomizePanel } from './DashboardCustomizePanel'

interface Props {
  statCards: ReactNode
  invoiceQuick: ReactNode
  storeLoans: ReactNode
  revenueChart: ReactNode
  lowStock: ReactNode
  expenses: ReactNode
  customerDues: ReactNode
  supplierPayments: ReactNode
  labelsQuick: ReactNode
  customersQuick: ReactNode
  suppliersQuick: ReactNode
}

export function DashboardWidgets({
  statCards,
  invoiceQuick,
  storeLoans,
  revenueChart,
  lowStock,
  expenses,
  customerDues,
  supplierPayments,
  labelsQuick,
  customersQuick,
  suppliersQuick,
}: Props) {
  const { visible, toggle, resetAll } = useDashboardWidgets()

  function w(id: WidgetId, node: ReactNode) {
    return visible[id] ? node : null
  }

  return (
    <>
      {w('stat_cards', statCards)}
      {w('invoice_quick', invoiceQuick)}
      {w('store_loans', storeLoans)}
      {(visible.revenue_chart || visible.low_stock) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {w('revenue_chart', revenueChart)}
          {w('low_stock', lowStock)}
        </div>
      )}
      {w('expenses', expenses)}
      {w('customer_dues', customerDues)}
      {w('supplier_payments', supplierPayments)}
      {w('labels_quick', labelsQuick)}
      {w('customers_quick', customersQuick)}
      {w('suppliers_quick', suppliersQuick)}

      <DashboardCustomizePanel visible={visible} toggle={toggle} resetAll={resetAll} />
    </>
  )
}
