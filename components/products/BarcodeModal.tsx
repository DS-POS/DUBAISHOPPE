'use client'

import React, { useRef } from 'react'
import Barcode from 'react-barcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PrinterIcon } from 'lucide-react'

interface BarcodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  sku: string
  barcode: string
  sellingPrice: number
}

export function BarcodeModal({
  open,
  onOpenChange,
  productName,
  sku,
  barcode,
  sellingPrice,
}: BarcodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const printContent = printRef.current
    if (!printContent) return

    const originalBody = document.body.innerHTML
    document.body.innerHTML = `
      <html><head>
        <title>Barcode - ${productName}</title>
        <style>
          body { display: flex; justify-content: center; align-items: center; padding: 20px; font-family: sans-serif; }
          .barcode-print { text-align: center; }
          .barcode-print h3 { font-size: 14px; margin-bottom: 4px; }
          .barcode-print p { font-size: 12px; margin: 2px 0; color: #555; }
        </style>
      </head><body>${printContent.outerHTML}</body></html>
    `
    window.print()
    document.body.innerHTML = originalBody
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Rubik, sans-serif' }}>
            Product Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div ref={printRef} className="barcode-print text-center">
            <h3 className="font-semibold text-sm text-[#111827] truncate max-w-[250px]">
              {productName}
            </h3>
            <p className="text-xs text-slate-500">SKU: {sku}</p>
            <div className="my-2">
              <Barcode
                value={barcode}
                width={1.5}
                height={60}
                fontSize={12}
                displayValue={true}
              />
            </div>
            <p className="text-sm font-semibold text-[#4B5563]">
              ₹{sellingPrice.toFixed(2)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] transition-all duration-200 text-white"
          >
            <PrinterIcon className="size-4 mr-1" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
