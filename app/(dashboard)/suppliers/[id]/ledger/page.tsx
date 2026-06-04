import { getSupplierLedger } from '@/actions/supplier-invoices'
import { SupplierLedgerTable } from '@/components/suppliers/SupplierLedgerTable'
import { LedgerExportButton } from '@/components/suppliers/LedgerExportButton'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function SupplierLedgerPage({ params }: Props) {
  const { id } = await params
  let ledger
  try { ledger = await getSupplierLedger(id) } catch { notFound() }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/suppliers/${id}`} className="size-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <ArrowLeftIcon className="size-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ledger.supplier_name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Account Statement / Ledger</p>
          </div>
        </div>
        <LedgerExportButton ledger={ledger} />
      </div>
      {ledger.transactions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <p className="font-semibold text-slate-600">No transactions found</p>
          <p className="text-sm text-slate-400 mt-1">Link supplier invoices to this supplier to see ledger</p>
        </div>
      ) : (
        <SupplierLedgerTable transactions={ledger.transactions} totalInvoiced={ledger.total_invoiced} totalPaid={ledger.total_paid} closingBalance={ledger.closing_balance} />
      )}
    </div>
  )
}
