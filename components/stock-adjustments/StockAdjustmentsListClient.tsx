'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { deleteStockAdjustment } from '@/actions/stock-adjustments'
import type { StockAdjustmentType } from '@/types/database'

const TYPE_LABELS: Record<StockAdjustmentType, string> = {
  found:      'Found / Received',
  return:     'Customer Return',
  damage:     'Damage / Loss',
  write_off:  'Write-Off',
  correction: 'Manual Correction',
}

const TYPE_CLASSES: Record<StockAdjustmentType, string> = {
  found:      'bg-emerald-100 text-emerald-700',
  return:     'bg-blue-100 text-blue-700',
  damage:     'bg-red-100 text-red-700',
  write_off:  'bg-red-100 text-red-700',
  correction: 'bg-amber-100 text-amber-700',
}

interface Adj {
  id: string
  products?: { id: string; name: string; sku: string; current_stock: number } | null
  adjustment_type: string
  quantity: number
  notes: string | null
  created_at: string
}

export function StockAdjustmentsListClient({ adjustments }: { adjustments: Adj[] }) {
  const [items, setItems] = useState(adjustments)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    if (!confirm('Delete this adjustment? This will reverse the stock change.')) return
    setDeletingId(id)
    try {
      await deleteStockAdjustment(id)
      setItems(prev => prev.filter(a => a.id !== id))
      toast.success('Adjustment deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <tbody>
      {items.map((adj, i) => (
        <tr key={adj.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
          <td className="px-4 py-3">
            <p className="font-semibold text-[#111827]">{adj.products?.name ?? '—'}</p>
            <p className="text-xs text-slate-500">{adj.products?.sku}</p>
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_CLASSES[adj.adjustment_type as StockAdjustmentType]}`}>
              {TYPE_LABELS[adj.adjustment_type as StockAdjustmentType]}
            </span>
          </td>
          <td className={`px-4 py-3 text-right font-bold ${adj.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {adj.quantity > 0 ? '+' : ''}{adj.quantity}
          </td>
          <td className="px-4 py-3 text-slate-500 text-sm max-w-xs truncate">
            {adj.notes ?? <span className="text-slate-300">—</span>}
          </td>
          <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
            {format(new Date(adj.created_at), 'dd MMM yyyy')}
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => router.push(`/stock-adjustments/${adj.id}`)}
                className="text-xs font-medium text-[#4B5563] hover:underline"
              >
                View
              </button>
              <button
                onClick={() => handleDelete(adj.id)}
                disabled={deletingId === adj.id}
                className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
              >
                {deletingId === adj.id ? '…' : 'Delete'}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  )
}
