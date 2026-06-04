'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { DownloadIcon } from 'lucide-react'
import type { CustomerStatement } from '@/actions/customers'

interface Props {
  statement: CustomerStatement
  customerName: string
}

export function StatementExportButton({ statement, customerName }: Props) {
  const [exporting, setExporting] = useState(false)

  function handleExport() {
    setExporting(true)
    try {
      const rows = [
        ['Date', 'Reference', 'Description', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'],
        ...statement.transactions.map(tx => [
          tx.date_display,
          tx.reference,
          tx.description,
          tx.debit > 0 ? tx.debit : '',
          tx.credit > 0 ? tx.credit : '',
          tx.balance,
        ]),
        [],
        ['', '', 'TOTAL', statement.total_invoiced, statement.total_paid, statement.closing_balance],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Statement')
      XLSX.writeFile(wb, `Statement_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || statement.transactions.length === 0}
      className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
    >
      <DownloadIcon className="size-4" />
      Export Excel
    </button>
  )
}
