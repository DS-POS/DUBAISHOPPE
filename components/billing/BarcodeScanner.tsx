'use client'

import { useEffect, useRef, useCallback } from 'react'

const BUFFER_CLEAR_MS = 200

interface UseBarcodeScanner {
  onScan: (barcode: string) => void
  enabled: boolean
}

export function useBarcodeScanner({ onScan, enabled }: UseBarcodeScanner) {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(0)
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (!enabled) return

    const now = Date.now()
    const delta = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      const code = buffer.current.trim()
      buffer.current = ''
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
      if (code.length >= 4) onScan(code)
      return
    }

    if (delta > 500 && buffer.current.length > 0) buffer.current = ''
    if (e.key.length === 1) buffer.current += e.key

    if (bufferTimer.current) clearTimeout(bufferTimer.current)
    bufferTimer.current = setTimeout(() => {
      const code = buffer.current.trim()
      buffer.current = ''
      if (code.length >= 8) onScan(code)
    }, BUFFER_CLEAR_MS)
  }, [onScan, enabled])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
    }
  }, [handleKeyDown])
}
