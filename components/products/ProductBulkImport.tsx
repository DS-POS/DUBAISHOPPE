'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { UploadIcon, FileSpreadsheetIcon, XCircleIcon, CheckCircleIcon, AlertTriangleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { bulkImportProducts, type ProductImportRow, type ImportResult } from '@/actions/import-products'

interface ParsedRow extends ProductImportRow {
  _rowIndex: number
  _status: 'new' | 'exists' | 'invalid'
  _error?: string
}

interface Props {
  existingSkusArr: string[]
}

type Step = 'upload' | 'preview' | 'done'

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['name', 'sku', 'category', 'brand', 'cost_price', 'selling_price', 'gst_rate', 'hsn_code', 'low_stock_alert', 'opening_stock'],
    ['Sony A7IV', 'SONY-A7IV', 'Cameras', 'Sony', 150000, 180000, 18, '8525', 2, 0],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, 'products-import-template.xlsx')
}

function toNumber(val: unknown): number {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function parseRows(rawRows: Record<string, unknown>[], existingSkusSet: Set<string>): ParsedRow[] {
  return rawRows.map((raw, idx) => {
    const name = String(raw['name'] ?? '').trim()
    const sku = String(raw['sku'] ?? '').trim()
    const cost_price = toNumber(raw['cost_price'])
    const selling_price = raw['selling_price'] != null ? toNumber(raw['selling_price']) : undefined
    const gst_rate = raw['gst_rate'] != null ? toNumber(raw['gst_rate']) : undefined
    const low_stock_alert = raw['low_stock_alert'] != null ? toNumber(raw['low_stock_alert']) : undefined
    const opening_stock = raw['opening_stock'] != null ? toNumber(raw['opening_stock']) : undefined

    const row: ParsedRow = {
      _rowIndex: idx + 1,
      _status: 'new',
      name,
      sku,
      category_name: raw['category'] ? String(raw['category']).trim() : undefined,
      brand: raw['brand'] ? String(raw['brand']).trim() : undefined,
      cost_price,
      selling_price,
      gst_rate,
      hsn_code: raw['hsn_code'] ? String(raw['hsn_code']).trim() : undefined,
      low_stock_alert,
      opening_stock,
    }

    if (!name || !sku || cost_price <= 0) {
      row._status = 'invalid'
      if (!name) row._error = 'Name is required'
      else if (!sku) row._error = 'SKU is required'
      else row._error = 'cost_price must be > 0'
    } else if (existingSkusSet.has(sku)) {
      row._status = 'exists'
    }

    return row
  })
}

const STATUS_BADGE: Record<ParsedRow['_status'], { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-green-100 text-green-700' },
  exists: { label: 'Duplicate', className: 'bg-yellow-100 text-yellow-700' },
  invalid: { label: 'Invalid', className: 'bg-red-100 text-red-700' },
}

export function ProductBulkImport({ existingSkusArr }: Props) {
  const existingSkusSet = useMemo(() => new Set(existingSkusArr), [existingSkusArr])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [conflictMode, setConflictMode] = useState<'skip' | 'update'>('skip')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState('')

  async function handleFile(file: File) {
    setParseError('')
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (rawRows.length === 0) {
        setParseError('The file is empty or has no data rows.')
        return
      }
      const rows = parseRows(rawRows, existingSkusSet)
      setParsedRows(rows)
      setStep('preview')
    } catch {
      setParseError('Failed to parse file. Please use the provided template.')
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    const validRows = parsedRows.filter(r => r._status !== 'invalid')
    if (validRows.length === 0) return
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const importRows: ProductImportRow[] = validRows.map(({ _rowIndex: _r, _status: _s, _error: _e, ...rest }) => rest)
      const res = await bulkImportProducts(importRows, conflictMode)
      setResult(res)
      setStep('done')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  function resetToUpload() {
    setStep('upload')
    setParsedRows([])
    setFileName('')
    setParseError('')
    setResult(null)
    setConflictMode('skip')
  }

  const newCount = parsedRows.filter(r => r._status === 'new').length
  const existsCount = parsedRows.filter(r => r._status === 'exists').length
  const invalidCount = parsedRows.filter(r => r._status === 'invalid').length
  const validRows = parsedRows.filter(r => r._status !== 'invalid')

  if (step === 'upload') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-base font-semibold text-slate-900">Upload File</h2>
          <p className="text-sm text-slate-500">Supported formats: .xlsx, .xls, .csv</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              dragging ? 'border-slate-900 bg-slate-900/5' : 'border-slate-200 hover:border-slate-900/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="p-3 rounded-full bg-slate-900/10">
              <UploadIcon className="size-6 text-slate-900" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-900">Drop your file here, or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv — max 10 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {parseError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <XCircleIcon className="size-4 shrink-0" />
              {parseError}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={downloadTemplate}
            >
              <FileSpreadsheetIcon className="size-4" />
              Download Template
            </Button>
            <span className="text-xs text-slate-400">Use this template to format your data correctly</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-green-500 inline-block" />
                  <span className="font-medium text-slate-900">{newCount}</span>
                  <span className="text-slate-500">new</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-yellow-400 inline-block" />
                  <span className="font-medium text-slate-900">{existsCount}</span>
                  <span className="text-slate-500">duplicate</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500 inline-block" />
                  <span className="font-medium text-slate-900">{invalidCount}</span>
                  <span className="text-slate-500">invalid</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</p>
            </div>
          </CardContent>
        </Card>

        {existsCount > 0 && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm font-medium text-slate-900 mb-2">Duplicate SKU handling</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="conflictMode"
                    value="skip"
                    checked={conflictMode === 'skip'}
                    onChange={() => setConflictMode('skip')}
                    className="accent-[#111827]"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="conflictMode"
                    value="update"
                    checked={conflictMode === 'update'}
                    onChange={() => setConflictMode('update')}
                    className="accent-[#111827]"
                  />
                  Update duplicates
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Cost Price</th>
                  <th className="px-4 py-3 text-right font-medium">Selling Price</th>
                  <th className="px-4 py-3 text-right font-medium">GST%</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsedRows.map(row => {
                  const badge = STATUS_BADGE[row._status]
                  return (
                    <tr key={row._rowIndex} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-400">{row._rowIndex}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[180px] truncate">
                        {row.name || <span className="text-red-400 italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        {row.sku || <span className="text-red-400 italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.category_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {row.cost_price > 0 ? row.cost_price.toLocaleString('en-IN') : <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {row.selling_price != null ? row.selling_price.toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">
                        {row.gst_rate != null ? `${row.gst_rate}%` : '18%'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        {row._error && (
                          <p className="text-xs text-red-500 mt-0.5">{row._error}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {parseError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircleIcon className="size-4 shrink-0" />
            {parseError}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="outline" onClick={resetToUpload} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 gap-1.5"
            onClick={handleImport}
            disabled={loading || validRows.length === 0}
          >
            {loading ? 'Importing…' : `Import ${validRows.length} Product${validRows.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="max-w-lg">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-100">
            <CheckCircleIcon className="size-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Import Complete</h2>
            <p className="text-sm text-slate-500">Your products have been processed.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-green-50 py-3">
            <p className="text-2xl font-bold text-green-700">{result?.created ?? 0}</p>
            <p className="text-xs text-green-600 mt-0.5">Created</p>
          </div>
          <div className="rounded-lg bg-blue-50 py-3">
            <p className="text-2xl font-bold text-blue-700">{result?.updated ?? 0}</p>
            <p className="text-xs text-blue-600 mt-0.5">Updated</p>
          </div>
          <div className="rounded-lg bg-slate-100 py-3">
            <p className="text-2xl font-bold text-slate-600">{result?.skipped ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Skipped</p>
          </div>
        </div>

        {result && result.errors.length > 0 && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1.5">
            <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
              <AlertTriangleIcon className="size-4" />
              {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} had errors
            </p>
            <ul className="text-xs text-red-600 space-y-0.5 max-h-36 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row} ({e.sku || 'no SKU'}): {e.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link href="/products" className="flex-1">
            <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all duration-200">
              Go to Product Inventory
            </Button>
          </Link>
          <Button variant="outline" onClick={resetToUpload}>
            Import More
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
