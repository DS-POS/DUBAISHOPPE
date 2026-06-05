'use client'

import { useEffect } from 'react'
import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function StatementPrintButton() {
  useEffect(() => {
    // Inject print CSS once
    if (!document.getElementById('statement-print-css')) {
      const link = document.createElement('link')
      link.id = 'statement-print-css'
      link.rel = 'stylesheet'
      link.href = '/statement-print.css'
      document.head.appendChild(link)
    }
  }, [])

  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <PrinterIcon className="size-4 mr-1.5" />
      Print
    </Button>
  )
}
