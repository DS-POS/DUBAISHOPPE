'use client'

import { Trash2Icon } from 'lucide-react'
import type { CartItem } from './types'

interface CartItemRowProps {
  item: CartItem
  onQtyChange: (id: string, qty: number) => void
  onRateChange: (id: string, rate: number) => void
  onDiscountChange: (id: string, discount: number) => void
  onRemove: (id: string) => void
  onPickSerial: (id: string) => void
}

export function CartItemRow({ item, onQtyChange, onRateChange, onDiscountChange, onRemove, onPickSerial }: CartItemRowProps) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <p className="text-sm font-medium leading-tight">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">{item.product.sku}</p>
        {item.product.serial_required && (
          <button
            type="button"
            onClick={() => onPickSerial(item._id)}
            className={`mt-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
              item.serial_number
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {item.serial_number ? `S/N: ${item.serial_number}` : '⚠ Pick serial'}
          </button>
        )}
      </td>
      <td className="px-3 py-2 w-24">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQtyChange(item._id, Math.max(1, item.quantity - 1))}
            className="size-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent"
          >−</button>
          <input
            type="number"
            value={item.quantity}
            min={1}
            onChange={e => onQtyChange(item._id, Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 text-center text-sm border border-input rounded h-6 bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => onQtyChange(item._id, item.quantity + 1)}
            className="size-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent"
          >+</button>
        </div>
      </td>
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <input
            type="number"
            value={item.rate}
            min={0}
            step={0.01}
            onChange={e => onRateChange(item._id, parseFloat(e.target.value) || 0)}
            className="w-full pl-5 pr-2 py-1 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </td>
      <td className="px-3 py-2 w-24">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <input
            type="number"
            value={item.discount}
            min={0}
            step={0.01}
            onChange={e => onDiscountChange(item._id, parseFloat(e.target.value) || 0)}
            className="w-full pl-5 pr-2 py-1 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </td>
      <td className="px-3 py-2 w-20 text-right text-xs text-muted-foreground">
        {item.product.gst_rate}%
      </td>
      <td className="px-3 py-2 w-24 text-right">
        <p className="text-sm font-medium">₹{item.total.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">GST: ₹{item.total_gst.toFixed(2)}</p>
      </td>
      <td className="px-3 py-2 w-10">
        <button
          type="button"
          onClick={() => onRemove(item._id)}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2Icon className="size-4" />
        </button>
      </td>
    </tr>
  )
}
