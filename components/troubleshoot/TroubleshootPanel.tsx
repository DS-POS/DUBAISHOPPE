'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckResult,
  runAllChecks,
  fixAuthSync,
  fixOrphanedInvoices,
} from '@/actions/troubleshoot'
import {
  CheckCircle2, AlertTriangle, XCircle,
  Loader2, Wrench, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

type CheckState = CheckResult & { running?: boolean; fixing?: boolean; fixed?: boolean }

const EMPTY: CheckState[] = [
  { id: 'db_connection',      label: 'Database Connection',         description: 'Checking…', status: 'pass', count: 0, detail: '', fixable: false, running: true },
  { id: 'auth_sync',          label: 'Auth User Sync',              description: 'Checking…', status: 'pass', count: 0, detail: '', fixable: false, running: true },
  { id: 'orphaned_invoices',  label: 'Supplier Invoice Integrity',  description: 'Checking…', status: 'pass', count: 0, detail: '', fixable: false, running: true },
  { id: 'negative_stock',     label: 'Negative Stock',              description: 'Checking…', status: 'pass', count: 0, detail: '', fixable: false, running: true },
]

export default function TroubleshootPanel() {
  const [checks, setChecks] = useState<CheckState[]>(EMPTY)
  const [scanning, setScanning] = useState(true)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const runChecks = useCallback(async () => {
    setScanning(true)
    setChecks(EMPTY)
    try {
      const results = await runAllChecks()
      setChecks(results.map(r => ({ ...r, running: false })))
      setLastRun(new Date())
    } catch (err) {
      toast.error('Scan failed: ' + String(err))
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => { runChecks() }, [runChecks])

  async function handleFix(id: string) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, fixing: true } : c))
    try {
      let result: { fixed: number }
      if (id === 'auth_sync') result = await fixAuthSync()
      else if (id === 'orphaned_invoices') result = await fixOrphanedInvoices()
      else return

      toast.success(`Fixed ${result.fixed} item(s) successfully`)
      setChecks(prev => prev.map(c =>
        c.id === id ? { ...c, fixing: false, fixed: true, status: 'pass', count: 0, detail: `Fixed ${result.fixed} item(s)`, fixable: false } : c
      ))
    } catch (err) {
      toast.error('Fix failed: ' + String(err))
      setChecks(prev => prev.map(c => c.id === id ? { ...c, fixing: false } : c))
    }
  }

  const issueCount = checks.filter(c => c.status === 'issue').length
  const errorCount = checks.filter(c => c.status === 'error').length
  const allClear = !scanning && issueCount === 0 && errorCount === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-500" />
            System Troubleshooter
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Diagnoses common issues and applies fixes automatically.
            {lastRun && (
              <span className="ml-2 text-slate-400">
                Last scan: {lastRun.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {scanning ? 'Scanning…' : 'Re-scan'}
        </button>
      </div>

      {/* Summary banner */}
      {!scanning && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ${
          allClear
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : errorCount > 0
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          {allClear ? (
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          {allClear
            ? 'All systems healthy — no issues found.'
            : `${issueCount + errorCount} issue(s) found. ${issueCount > 0 ? 'Click Fix to resolve.' : ''}`}
        </div>
      )}

      {/* Check cards */}
      <div className="space-y-3">
        {checks.map(check => (
          <CheckCard key={check.id} check={check} onFix={() => handleFix(check.id)} />
        ))}
      </div>
    </div>
  )
}

function CheckCard({ check, onFix }: { check: CheckState; onFix: () => void }) {
  const isRunning = check.running || check.fixing

  return (
    <div className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-all ${
      check.status === 'error' ? 'border-red-200 bg-red-50/30' :
      check.status === 'issue' ? 'border-amber-200 bg-amber-50/30' :
      'border-slate-200'
    }`}>
      {/* Icon */}
      <div className="mt-0.5 flex-shrink-0">
        {isRunning ? (
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        ) : check.status === 'pass' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : check.status === 'issue' ? (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800">{check.label}</p>
          {check.count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {check.count} issue{check.count > 1 ? 's' : ''}
            </span>
          )}
          {check.fixed && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Fixed
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {isRunning && !check.fixing ? 'Running check…' : check.fixing ? 'Applying fix…' : check.detail || check.description}
        </p>
      </div>

      {/* Fix button */}
      {check.fixable && !check.fixed && (
        <button
          onClick={onFix}
          disabled={isRunning}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {check.fixing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5" />
          )}
          Fix
        </button>
      )}
    </div>
  )
}
