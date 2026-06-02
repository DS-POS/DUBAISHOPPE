'use client'

import { useState, useEffect } from 'react'
import { XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/database'

interface SerialPickerProps {
  product: Product
  onSelect: (serial: string) => void
  onClose: () => void
}

export function SerialPicker({ product, onSelect, onClose }: SerialPickerProps) {
  const [serials, setSerials] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('product_serials')
      .select('serial_number')
      .eq('product_id', product.id)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setSerials((data ?? []).map(r => r.serial_number))
        setLoading(false)
      })
  }, [product.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm mx-4 rounded-xl bg-background border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="font-medium text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">Select a serial number</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
          ) : serials.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No available serials.</p>
          ) : (
            serials.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(s)}
                className="w-full px-4 py-2.5 text-left text-sm font-mono hover:bg-accent transition-colors"
              >
                {s}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
