'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckResult,
  runDbConnectionCheck,
  runAuthSyncCheck,
  runOrphanedInvoicesCheck,
  runNegativeStockCheck,
  runEmailConfigCheck,
  fixAuthSync,
  fixOrphanedInvoices,
} from '@/actions/troubleshoot'
import {
  CheckCircle2, AlertTriangle, XCircle,
  Loader2, Wrench, RefreshCw, ShieldCheck, Zap, Circle,
} from 'lucide-react'
import { toast } from 'sonner'

type ExtStatus = CheckResult['status'] | 'pending' | 'running'
type CheckState = Omit<CheckResult, 'status'> & {
  status: ExtStatus
  fixed?: boolean
  fixing?: boolean
}

const CHECKS_META = [
  { id: 'db_connection',     label: 'Database Connection',        fn: runDbConnectionCheck },
  { id: 'auth_sync',         label: 'Auth User Sync',             fn: runAuthSyncCheck },
  { id: 'orphaned_invoices', label: 'Supplier Invoice Integrity', fn: runOrphanedInvoicesCheck },
  { id: 'negative_stock',    label: 'Negative Stock',             fn: runNegativeStockCheck },
  { id: 'email_config',      label: 'Email Configuration',        fn: runEmailConfigCheck },
]

const INITIAL: CheckState[] = CHECKS_META.map(c => ({
  id: c.id, label: c.label, description: 'Waiting to run…',
  status: 'pending', count: 0, detail: '', fixable: false,
}))

export default function TroubleshootPanel() {
  const [checks, setChecks] = useState<CheckState[]>(INITIAL)
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const runChecks = useCallback(async () => {
    setScanning(true)
    setDone(false)
    setChecks(INITIAL)

    for (let i = 0; i < CHECKS_META.length; i++) {
      const meta = CHECKS_META[i]
      setChecks(prev => prev.map(c =>
        c.id === meta.id ? { ...c, status: 'running', description: 'Checking…' } : c
      ))

      try {
        const result = await meta.fn()
        setChecks(prev => prev.map(c =>
          c.id === meta.id ? { ...result, fixed: false, fixing: false } : c
        ))
      } catch (err) {
        setChecks(prev => prev.map(c =>
          c.id === meta.id
            ? { ...c, status: 'error', detail: String(err), description: 'Check failed' }
            : c
        ))
      }

      if (i < CHECKS_META.length - 1) {
        await new Promise(r => setTimeout(r, 250))
      }
    }

    setLastRun(new Date())
    setScanning(false)
    setDone(true)
  }, [])

  useEffect(() => { runChecks() }, [runChecks])

  async function handleFix(id: string) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, fixing: true } : c))
    try {
      let result: { fixed: number }
      if (id === 'auth_sync') result = await fixAuthSync()
      else if (id === 'orphaned_invoices') result = await fixOrphanedInvoices()
      else return

      toast.success(`Fixed ${result.fixed} item(s)`)
      setChecks(prev => prev.map(c =>
        c.id === id
          ? { ...c, fixing: false, fixed: true, status: 'pass', count: 0, detail: `Fixed ${result.fixed} item(s)`, fixable: false }
          : c
      ))
    } catch (err) {
      toast.error('Fix failed: ' + String(err))
      setChecks(prev => prev.map(c => c.id === id ? { ...c, fixing: false } : c))
    }
  }

  async function handleFixAll() {
    for (const check of checks.filter(c => c.fixable && !c.fixed)) {
      await handleFix(check.id)
    }
  }

  const completedCount = checks.filter(c => c.status !== 'pending' && c.status !== 'running').length
  const issueCount = checks.filter(c => c.status === 'issue').length
  const errorCount = checks.filter(c => c.status === 'error').length
  const fixableCount = checks.filter(c => c.fixable && !c.fixed).length
  const allClear = done && issueCount === 0 && errorCount === 0
  const progress = (completedCount / CHECKS_META.length) * 100

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-500" />
            System Troubleshooter
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Runs diagnostic checks and applies fixes automatically.
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Re-scan'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>
            {scanning
              ? `Running check ${completedCount + 1} of ${CHECKS_META.length}…`
              : done ? 'Scan complete' : 'Ready to scan'}
          </span>
          <span>{completedCount}/{CHECKS_META.length} checks</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              allClear ? 'bg-emerald-500'
              : errorCount > 0 ? 'bg-red-500'
              : issueCount > 0 ? 'bg-amber-500'
              : 'bg-indigo-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Check cards */}
      <div className="space-y-2.5">
        {checks.map(check => (
          <CheckCard key={check.id} check={check} onFix={() => handleFix(check.id)} />
        ))}
      </div>

      {/* Completion banner */}
      {done && (
        <div className={`rounded-xl px-5 py-4 flex items-center gap-4 border ${
          allClear
            ? 'bg-emerald-50 border-emerald-200'
            : errorCount > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {allClear ? (
            <ShieldCheck className="w-9 h-9 text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-9 h-9 text-amber-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-base ${
              allClear ? 'text-emerald-700' : errorCount > 0 ? 'text-red-700' : 'text-amber-700'
            }`}>
              {allClear
                ? 'Troubleshooting Complete — All Systems Healthy'
                : `${issueCount + errorCount} Issue${issueCount + errorCount > 1 ? 's' : ''} Found`}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {allClear
                ? `All ${CHECKS_META.length} checks passed. No action required.`
                : fixableCount > 0
                ? `${fixableCount} issue${fixableCount > 1 ? 's' : ''} can be fixed automatically.`
                : 'Issues require manual review.'}
            </p>
          </div>
          {fixableCount > 0 && (
            <button
              onClick={handleFixAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              <Zap className="w-4 h-4" />
              Fix All
            </button>
          )}
        </div>
      )}

      {lastRun && (
        <p className="text-xs text-slate-400 text-center">
          Last scan: {lastRun.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

function CheckCard({ check, onFix }: { check: CheckState; onFix: () => void }) {
  const isPending = check.status === 'pending'
  const isRunning = check.status === 'running' || check.fixing

  return (
    <div className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-all duration-300 ${
      check.status === 'error'  ? 'border-red-200 bg-red-50/30' :
      check.status === 'issue'  ? 'border-amber-200 bg-amber-50/30' :
      check.status === 'pass'   ? 'border-emerald-200 bg-emerald-50/20' :
      isPending                 ? 'border-slate-100 opacity-50' :
      'border-indigo-200 bg-indigo-50/20'
    }`}>
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isPending ? (
          <Circle className="w-5 h-5 text-slate-300" />
        ) : isRunning ? (
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
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
          {check.status === 'pass' && !isPending && !isRunning && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              ✓ Pass
            </span>
          )}
          {check.count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {check.count} issue{check.count > 1 ? 's' : ''}
            </span>
          )}
          {check.fixed && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              ✓ Fixed
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {isPending
            ? 'Waiting…'
            : isRunning && !check.fixing
            ? 'Running check…'
            : check.fixing
            ? 'Applying fix…'
            : check.detail || check.description}
        </p>
      </div>

      {/* Fix button */}
      {check.fixable && !check.fixed && !isPending && (
        <button
          onClick={onFix}
          disabled={isRunning}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {check.fixing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Wrench className="w-3.5 h-3.5" />}
          Fix
        </button>
      )}
    </div>
  )
}
