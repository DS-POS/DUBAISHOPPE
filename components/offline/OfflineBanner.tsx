'use client'

import { WifiOffIcon, RefreshCwIcon, CloudUploadIcon } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const { isOnline, pendingCount, syncing, attemptSync } = useOnlineStatus()

  if (isOnline && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
        <div className="flex items-center gap-2">
          <WifiOffIcon className="size-4 flex-shrink-0" />
          <span>Offline — billing continues. Invoices saved locally.</span>
        </div>
        {pendingCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  // Back online but still have pending invoices
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <CloudUploadIcon className="size-4 flex-shrink-0" />
        <span>{pendingCount} offline invoice{pendingCount !== 1 ? 's' : ''} pending sync</span>
      </div>
      <button
        onClick={attemptSync}
        disabled={syncing}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-60"
      >
        <RefreshCwIcon className={`size-3 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}
