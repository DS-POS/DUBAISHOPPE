'use client'

import { Trash2Icon } from 'lucide-react'
import type { CartItem } from './types'

interface CartItemRowProps {
  item: CartItem
  onQtyChange: (id: string, qty: number) => void
  onRateChange: (id: string, rate: number) => void
  onDiscountChange: (id: string, raw: number) => void
  onDiscountModeChange: (id: string, mode: 'percent' | 'flat') => void
  onRemove: (id: string) => void
  onPickSerial: (id: string) => void
}

export function CartItemRow({
  item,
  onQtyChange,
  onRateChange,
  onDiscountChange,
  onDiscountModeChange,
  onRemove,
  onPickSerial,
}: CartItemRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{item.product.name}</p>
        <p className="text-xs text-slate-400">{item.product.sku}</p>
        {item.product.serial_required && (
          <button
            type="button"
            onClick={() => onPickSerial(item._id)}
            className={`mt-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
              item.serial_number
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            {item.serial_number ? `S/N: ${item.serial_number}` : '⚠ Pick serial'}
          </button>
        )}
      </td>
      <td className="px-4 py-3 w-28">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQtyChange(item._id, Math.max(1, item.quantity - 1))}
            className="size-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 font-bold transition-colors"
          >−</button>
          <input
            type="number"
            value={item.quantity}
            min={1}
            onChange={e => onQtyChange(item._id, Math.max(1, parseInt(e.target.value) || 1))}
            onFocus={e => e.target.select()}
            className="w-10 text-center text-sm font-semibold border border-slate-200 rounded-lg h-7 bg-white outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
          <button
            type="button"
            onClick={() => onQtyChange(item._id, item.quantity + 1)}
            className="size-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 font-bold transition-colors"
          >+</button>
        </div>
      </td>
      <td className="px-4 py-3 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
          <input
            type="number"
            value={item.rate}
            min={0}
            step={0.01}
            onChange={e => onRateChange(item._id, parseFloat(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            className="w-full pl-5 pr-2 py-1.5 text-sm font-medium border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
          />
        </div>
      </td>
      <td className="px-4 py-3 w-32">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onDiscountModeChange(
                item._id,
                item.discount_mode === 'percent' ? 'flat' : 'percent'
              )
            }
            className="shrink-0 h-8 w-8 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-600 transition-colors"
            title={item.discount_mode === 'percent' ? 'Switch to flat ₹' : 'Switch to %'}
          >
            {item.discount_mode === 'percent' ? '%' : '₹'}
          </button>
          <div className="relative flex-1">
            <input
              type="number"
              value={item.discount_raw}
              min={0}
              step={item.discount_mode === 'percent' ? 0.1 : 0.01}
              max={item.discount_mode === 'percent' ? 100 : undefined}
              onChange={e => onDiscountChange(item._id, parseFloat(e.target.value) || 0)}
              onFocus={e => e.target.select()}
              className="w-full px-2 py-1.5 text-sm font-medium border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827]"
            />
          </div>
        </div>
        {item.discount > 0 && item.discount_mode === 'percent' && (
          <p className="text-xs text-slate-400 mt-0.5 pl-9">= ₹{item.discount.toFixed(2)}</p>
        )}
      </td>
      <td className="px-4 py-3 w-20 text-right text-xs text-slate-400 font-medium">
        {item.is_taxable ? `${item.product.gst_rate}%` : '—'}
      </td>
      <td className="px-4 py-3 w-24 text-right">
        <p className="text-sm font-bold text-slate-900">₹{item.total.toFixed(2)}</p>
        {item.is_taxable && (
          <p className="text-xs text-slate-400">GST: ₹{item.total_gst.toFixed(2)}</p>
        )}
      </td>
      <td className="px-4 py-3 w-10">
        <button
          type="button"
          onClick={() => onRemove(item._id)}
          className="text-slate-300 hover:text-red-500 transition-colors"
        >
          <Trash2Icon className="size-4" />
        </button>
      </td>
    </tr>
  )
}
