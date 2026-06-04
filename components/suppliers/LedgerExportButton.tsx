'use client'
import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import type { SupplierLedger } from '@/actions/supplier-invoices'

export function LedgerExportButton({ ledger }: { ledger: SupplierLedger }) {
  const [loading, setLoading] = useState(false)
  async function handleExport() {
    setLoading(true)
    try {
      const xlsx = await import('xlsx')
      const rows = [
        ...ledger.transactions.map(tx => ({ Date: tx.date, Reference: tx.reference, Description: tx.description, 'Debit (₹)': tx.debit || '', 'Credit (₹)': tx.credit || '', 'Balance (₹)': tx.balance })),
        { Date: '', Reference: '', Description: 'CLOSING BALANCE', 'Debit (₹)': '', 'Credit (₹)': '', 'Balance (₹)': ledger.closing_balance },
      ]
      const ws = xlsx.utils.json_to_sheet(rows)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Ledger')
      xlsx.writeFile(wb, `${ledger.supplier_name}-ledger.xlsx`)
    } finally { setLoading(false) }
  }
  return (
    <button onClick={handleExport} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
      <DownloadIcon className="size-4" />{loading ? 'Exporting...' : 'Export Excel'}
    </button>
  )
}
