'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  exportSalesVouchersXML,
  exportPurchaseVouchersXML,
  exportStockMastersXML,
  exportLedgerMastersXML,
  getExportLogs,
  type ExportLogRow,
} from '@/actions/tally-export'
import { generateGSTR1, getGSTR1Summary, type GSTR1Summary } from '@/actions/gstr1-export'
import { sendGSTR1Email } from '@/actions/send-gstr1-email'
import { STORE } from '@/lib/store-constants'
import { toast } from 'sonner'
import {
  FileDown,
  ShoppingCart,
  PackageOpen,
  Boxes,
  Users,
  Clock,
  Loader2,
  FileCode2,
  TriangleAlert,
  FileJson,
  Mail,
  CheckCircle2,
} from 'lucide-react'

// ── helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d: Date) {
  return d.toISOString().split('T')[0]
}

function downloadJSON(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Quarter → { from, to } dates for the fiscal year containing `today` */
function getQuarterRange(q: 1 | 2 | 3 | 4): { from: string; to: string } {
  const now    = new Date()
  const year   = now.getFullYear()
  // FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  const ranges: Record<number, { from: string; to: string }> = {
    1: { from: `${year}-04-01`,   to: `${year}-06-30` },
    2: { from: `${year}-07-01`,   to: `${year}-09-30` },
    3: { from: `${year}-10-01`,   to: `${year}-12-31` },
    4: { from: `${year + 1}-01-01`, to: `${year + 1}-03-31` },
  }
  return ranges[q]
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 29)
  return { from: toDateInput(from), to: toDateInput(to) }
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function humanExportType(t: string) {
  const map: Record<string, string> = {
    sales_vouchers:    'Sales Vouchers',
    purchase_vouchers: 'Purchase Vouchers',
    stock_masters:     'Stock Masters',
    ledger_masters:    'Ledger Masters',
  }
  return map[t] ?? t
}

function downloadXML(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl ring-1 ring-black/[0.06] shadow-sm p-6 ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="mt-0.5 inline-flex items-center justify-center bg-[#E5E7EB] text-[#4B5563] rounded-xl p-2 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="font-bold text-[#111827] text-base">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">From</label>
        <input
          type="date"
          value={from}
          onChange={e => onFromChange(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 bg-[#F3F4F6]"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To</label>
        <input
          type="date"
          value={to}
          onChange={e => onToChange(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 bg-[#F3F4F6]"
        />
      </div>
    </div>
  )
}

function ExportButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98]"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {children}
    </button>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export default function TallyPage() {
  const defaults = getDefaultRange()

  // Sales Vouchers state
  const [salesFrom, setSalesFrom] = useState(defaults.from)
  const [salesTo,   setSalesTo]   = useState(defaults.to)
  const [salesPending, startSales] = useTransition()

  // Purchase Vouchers state
  const [purchFrom, setPurchFrom] = useState(defaults.from)
  const [purchTo,   setPurchTo]   = useState(defaults.to)
  const [purchPending, startPurch] = useTransition()

  // Masters state
  const [stockPending,  startStock]  = useTransition()
  const [ledgerPending, startLedger] = useTransition()

  // Export history
  const [logs, setLogs]         = useState<ExportLogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // GSTR-1 state
  const [gstrFrom,  setGstrFrom]  = useState(defaults.from)
  const [gstrTo,    setGstrTo]    = useState(defaults.to)
  const [gstrGstin, setGstrGstin] = useState<string>(STORE.gstin)
  const [gstrPending, startGstr]  = useTransition()
  const [gstrSummary, setGstrSummary] = useState<GSTR1Summary | null>(null)
  const [gstrJson,    setGstrJson]    = useState<object | null>(null)
  // Email sub-form
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [acctEmail,     setAcctEmail]     = useState('')
  const [emailPending,  startEmail]       = useTransition()

  async function refreshLogs() {
    try {
      setLogsLoading(true)
      const data = await getExportLogs()
      setLogs(data)
    } catch {
      // silently fail — history is non-critical
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    refreshLogs()
  }, [])

  // ── export handlers ──────────────────────────────────────────────────────

  function handleSalesExport() {
    if (!salesFrom || !salesTo) {
      toast.error('Please select a date range')
      return
    }
    startSales(async () => {
      try {
        const xml = await exportSalesVouchersXML(salesFrom, salesTo)
        downloadXML(xml, `tally-sales-${salesFrom}-to-${salesTo}.xml`)
        toast.success('Sales vouchers exported successfully')
        await refreshLogs()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    })
  }

  function handlePurchExport() {
    if (!purchFrom || !purchTo) {
      toast.error('Please select a date range')
      return
    }
    startPurch(async () => {
      try {
        const xml = await exportPurchaseVouchersXML(purchFrom, purchTo)
        downloadXML(xml, `tally-purchases-${purchFrom}-to-${purchTo}.xml`)
        toast.success('Purchase vouchers exported successfully')
        await refreshLogs()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    })
  }

  function handleStockExport() {
    startStock(async () => {
      try {
        const xml = await exportStockMastersXML()
        downloadXML(xml, `tally-stock-masters-${toDateInput(new Date())}.xml`)
        toast.success('Stock masters exported successfully')
        await refreshLogs()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    })
  }

  function handleGstrExport() {
    if (!gstrFrom || !gstrTo) {
      toast.error('Please select a date range')
      return
    }
    if (!gstrGstin.trim()) {
      toast.error('Please enter store GSTIN')
      return
    }
    startGstr(async () => {
      try {
        const [json, summary] = await Promise.all([
          generateGSTR1(gstrFrom, gstrTo, gstrGstin.trim()),
          getGSTR1Summary(gstrFrom, gstrTo),
        ])
        setGstrJson(json)
        setGstrSummary(summary)
        const toD      = new Date(gstrTo)
        const mm       = String(toD.getMonth() + 1).padStart(2, '0')
        const yyyy     = toD.getFullYear()
        downloadJSON(json, `GSTR1_${mm}${yyyy}.json`)
        toast.success('GSTR-1 JSON downloaded successfully')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    })
  }

  function handleSendGstEmail() {
    if (!acctEmail.trim()) {
      toast.error('Please enter accountant email')
      return
    }
    if (!gstrJson) {
      toast.error('Generate GSTR-1 first before emailing')
      return
    }
    startEmail(async () => {
      try {
        const result = await sendGSTR1Email({
          to:         acctEmail.trim(),
          from_date:  gstrFrom,
          to_date:    gstrTo,
          gstin:      gstrGstin.trim(),
          gstr1Json:  gstrJson,
        })
        if (result.success) {
          toast.success('GSTR-1 email sent successfully')
          setShowEmailForm(false)
          setAcctEmail('')
        } else {
          toast.error(result.error ?? 'Email failed')
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Email failed')
      }
    })
  }

  function handleLedgerExport() {
    startLedger(async () => {
      try {
        const xml = await exportLedgerMastersXML()
        downloadXML(xml, `tally-ledger-masters-${toDateInput(new Date())}.xml`)
        toast.success('Ledger masters exported successfully')
        await refreshLogs()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    })
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-16" style={{ fontFamily: 'Rubik, sans-serif' }}>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Tally Export</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Export data in Tally-compatible XML format for accountant import
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-700 text-xs font-medium">
          <TriangleAlert className="size-3.5 shrink-0" />
          XML only — no live sync with Tally
        </div>
      </div>

      {/* Sales Vouchers */}
      <SectionCard>
        <SectionHeader
          icon={<ShoppingCart className="size-4" />}
          title="Sales Vouchers"
          description="Export sales invoices as Tally sales vouchers with GST ledger entries"
        />
        <DateRangePicker
          from={salesFrom}
          to={salesTo}
          onFromChange={setSalesFrom}
          onToChange={setSalesTo}
        />
        <ExportButton onClick={handleSalesExport} loading={salesPending}>
          Export Sales XML
        </ExportButton>
      </SectionCard>

      {/* Purchase Vouchers */}
      <SectionCard>
        <SectionHeader
          icon={<PackageOpen className="size-4" />}
          title="Purchase Vouchers"
          description="Export stock-in / supplier invoices as Tally purchase vouchers"
        />
        <DateRangePicker
          from={purchFrom}
          to={purchTo}
          onFromChange={setPurchFrom}
          onToChange={setPurchTo}
        />
        <ExportButton onClick={handlePurchExport} loading={purchPending}>
          Export Purchases XML
        </ExportButton>
      </SectionCard>

      {/* Masters */}
      <SectionCard>
        <SectionHeader
          icon={<Boxes className="size-4" />}
          title="Master Data"
          description="Export stock items and ledgers — no date range required"
        />
        <div className="flex flex-wrap gap-3">

          {/* Stock Masters */}
          <div className="flex-1 min-w-[220px] bg-[#F3F4F6] rounded-xl ring-1 ring-black/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="size-3.5 text-[#4B5563]" />
              <span className="text-sm font-semibold text-[#111827]">Stock Masters</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              All active products with opening balances, HSN codes, and GST rates
            </p>
            <ExportButton onClick={handleStockExport} loading={stockPending}>
              Export Stock XML
            </ExportButton>
          </div>

          {/* Ledger Masters */}
          <div className="flex-1 min-w-[220px] bg-[#F3F4F6] rounded-xl ring-1 ring-black/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-3.5 text-[#4B5563]" />
              <span className="text-sm font-semibold text-[#111827]">Ledger Masters</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Customers (Sundry Debtors) and suppliers (Sundry Creditors) with GSTIN
            </p>
            <ExportButton onClick={handleLedgerExport} loading={ledgerPending}>
              Export Ledger XML
            </ExportButton>
          </div>
        </div>
      </SectionCard>

      {/* GSTR-1 Export */}
      <SectionCard>
        <SectionHeader
          icon={<FileJson className="size-4" />}
          title="GSTR-1 Export"
          description="Official JSON format for GST portal direct upload"
        />

        {/* Quarter quick-select */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick Select Quarter</p>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4] as const).map(q => {
              const labels: Record<number, string> = { 1: 'Q1 Apr–Jun', 2: 'Q2 Jul–Sep', 3: 'Q3 Oct–Dec', 4: 'Q4 Jan–Mar' }
              return (
                <button
                  key={q}
                  onClick={() => {
                    const r = getQuarterRange(q)
                    setGstrFrom(r.from)
                    setGstrTo(r.to)
                    setGstrSummary(null)
                    setGstrJson(null)
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#E5E7EB] text-[#111827] hover:bg-[#D1D5DB] border border-[#D1D5DB] transition-colors"
                >
                  {labels[q]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date range */}
        <DateRangePicker
          from={gstrFrom}
          to={gstrTo}
          onFromChange={v => { setGstrFrom(v); setGstrSummary(null); setGstrJson(null) }}
          onToChange={v   => { setGstrTo(v);   setGstrSummary(null); setGstrJson(null) }}
        />

        {/* GSTIN input */}
        <div className="flex flex-col gap-0.5 mb-4">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Store GSTIN</label>
          <input
            type="text"
            value={gstrGstin}
            onChange={e => setGstrGstin(e.target.value)}
            placeholder="36XXXXXXXXXXXXX"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 bg-[#F3F4F6] max-w-xs font-mono"
          />
        </div>

        {/* Generate button */}
        <div className="flex flex-wrap items-center gap-3">
          <ExportButton onClick={handleGstrExport} loading={gstrPending}>
            Generate &amp; Download JSON
          </ExportButton>

          {gstrJson && (
            <button
              onClick={() => setShowEmailForm(v => !v)}
              className="inline-flex items-center gap-2 border border-[#4B5563] text-[#111827] hover:bg-[#E5E7EB] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Mail className="size-4" />
              Email to Accountant
            </button>
          )}
        </div>

        {/* Email sub-form */}
        {showEmailForm && gstrJson && (
          <div className="mt-4 p-4 bg-[#F3F4F6] rounded-xl ring-1 ring-black/[0.06] flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Accountant Email</label>
              <input
                type="email"
                value={acctEmail}
                onChange={e => setAcctEmail(e.target.value)}
                placeholder="accountant@example.com"
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-white"
              />
            </div>
            <button
              onClick={handleSendGstEmail}
              disabled={emailPending}
              className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98]"
            >
              {emailPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Send Email
            </button>
          </div>
        )}

        {/* Summary card */}
        {gstrSummary && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'B2B Invoices',    value: gstrSummary.b2bCount,    suffix: '' },
              { label: 'B2CL Invoices',   value: gstrSummary.b2clCount,   suffix: '' },
              { label: 'B2CS Entries',    value: gstrSummary.b2csCount,   suffix: '' },
              { label: 'HSN Rows',        value: gstrSummary.hsnCount,    suffix: '' },
              { label: 'Taxable Amount',  value: gstrSummary.totalTaxable, suffix: '₹', isAmount: true },
              { label: 'Total CGST',      value: gstrSummary.totalCGST,    suffix: '₹', isAmount: true },
              { label: 'Total SGST',      value: gstrSummary.totalSGST,    suffix: '₹', isAmount: true },
              { label: 'Grand Total',     value: gstrSummary.grandTotal,   suffix: '₹', isAmount: true },
            ].map(item => (
              <div key={item.label} className="bg-[#F3F4F6] rounded-xl ring-1 ring-black/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{item.label}</p>
                <p className="text-base font-bold text-[#111827] tabular-nums">
                  {item.isAmount
                    ? `₹${Number(item.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : item.value}
                </p>
              </div>
            ))}
            <div className="col-span-full flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="size-3.5 shrink-0" />
              JSON downloaded. Ready for GST portal upload.
            </div>
          </div>
        )}
      </SectionCard>

      {/* Export History */}
      <SectionCard>
        <SectionHeader
          icon={<Clock className="size-4" />}
          title="Export History"
          description="Last 20 exports from this session and all time"
        />

        {logsLoading ? (
          <div className="flex items-center gap-2 py-6 text-slate-400 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading history...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <FileCode2 className="size-8 opacity-40" />
            <p className="text-sm">No exports yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-[#111827] border-b border-[#1F2937]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Date Range
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Exported At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#F3F4F6] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#111827]">
                      {humanExportType(log.export_type)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                      {log.date_from && log.date_to
                        ? `${log.date_from} → ${log.date_to}`
                        : <span className="text-slate-400 italic">All time</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
