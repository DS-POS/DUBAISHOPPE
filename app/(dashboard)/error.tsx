'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-2 font-mono">Ref: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  )
}
