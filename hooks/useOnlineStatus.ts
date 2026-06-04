'use client'

import { useEffect, useState, useCallback } from 'react'
import { syncOfflineInvoices, getPendingCount } from '@/lib/offline/cache-sync'
import { toast } from 'sonner'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  // Only runs client-side
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = async () => {
      setIsOnline(true)
      await attemptSync()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast.warning('You are offline. Billing will continue — invoices saved locally.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll pending count every 30s
  useEffect(() => {
    refreshPendingCount()
    const id = setInterval(refreshPendingCount, 30_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPendingCount() {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch { /* IndexedDB may not be available in SSR */ }
  }

  const attemptSync = useCallback(async () => {
    const count = await getPendingCount()
    if (count === 0) return
    setSyncing(true)
    try {
      const result = await syncOfflineInvoices()
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline invoice${result.synced > 1 ? 's' : ''}.`)
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} invoice${result.failed > 1 ? 's' : ''} failed to sync — will retry.`)
      }
      await refreshPendingCount()
    } finally {
      setSyncing(false)
    }
  }, [])

  return { isOnline, pendingCount, syncing, attemptSync, refreshPendingCount }
}
