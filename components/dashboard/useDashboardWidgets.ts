'use client'
import { useState, useEffect } from 'react'

export const WIDGET_DEFS = [
  { id: 'stat_cards',         label: 'Stats Overview',        desc: '5 key business metrics' },
  { id: 'invoice_quick',      label: 'Invoice Quick Access',  desc: "Today's & pending invoices" },
  { id: 'store_loans',        label: 'Store Loans',           desc: 'Active loans summary' },
  { id: 'revenue_chart',      label: 'Revenue Chart',         desc: '30-day revenue trend' },
  { id: 'low_stock',          label: 'Low Stock Alerts',      desc: 'Products running low' },
  { id: 'expenses',           label: 'Expenses This Month',   desc: 'Monthly expense overview' },
  { id: 'customer_dues',      label: 'Customer Dues',         desc: 'Outstanding customer payments' },
  { id: 'supplier_payments',  label: 'Supplier Payments',     desc: 'Pending supplier invoices' },
  { id: 'labels_quick',       label: 'Label Printer',         desc: 'Quick access to barcode labels' },
  { id: 'customers_quick',    label: 'Customers Summary',     desc: 'Total customers overview' },
  { id: 'suppliers_quick',    label: 'Suppliers Summary',     desc: 'Active suppliers overview' },
] as const

export type WidgetId = (typeof WIDGET_DEFS)[number]['id']

const STORAGE_KEY = 'ds-pos-dashboard-widgets'
const DEFAULT_OFF = new Set<string>(['labels_quick', 'customers_quick', 'suppliers_quick'])

function getDefaults(): Record<WidgetId, boolean> {
  return Object.fromEntries(WIDGET_DEFS.map(w => [w.id, !DEFAULT_OFF.has(w.id)])) as Record<WidgetId, boolean>
}

export function useDashboardWidgets() {
  const [visible, setVisible] = useState<Record<WidgetId, boolean>>(getDefaults)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<WidgetId, boolean>>
        setVisible(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
  }, [])

  function toggle(id: WidgetId) {
    setVisible(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function resetAll() {
    const defaults = getDefaults()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
    setVisible(defaults)
  }

  return { visible, toggle, resetAll }
}
