'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSettings, uploadStoreAsset } from '@/actions/settings'
import type { StoreSettings, BankAccount } from '@/lib/settings-types'
import { MAX_BANK_ACCOUNTS, EMPTY_BANK } from '@/lib/settings-types'
import { Loader2, Plus, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'

interface SettingsFormProps {
  initialSettings: StoreSettings
}

function BankAccountCard({
  account, index, total,
  onChange, onRemove,
}: {
  account: BankAccount
  index: number
  total: number
  onChange: (i: number, field: keyof BankAccount, val: string) => void
  onRemove: (i: number) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const f = (field: keyof BankAccount) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange(index, field, e.target.value)

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-200 hover:bg-slate-300 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-900">
          Account {index + 1}{account.bank_name ? ` — ${account.bank_name}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onRemove(index) }}
              onKeyDown={e => e.key === 'Enter' && onRemove(index)}
              className="text-red-400 hover:text-red-600 transition-colors p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
          {([
            ['bank_name', 'Bank Name', 'e.g. ICICI BANK'],
            ['account_name', 'Account Holder Name', 'e.g. Dubai Shoppe'],
            ['account_number', 'Account Number', 'e.g. 665005500205'],
            ['ifsc', 'IFSC Code', 'e.g. ICIC0006650'],
          ] as [keyof BankAccount, string, string][]).map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1">
              <Label className="text-slate-900 text-xs">{label}</Label>
              <Input
                value={account[key]}
                onChange={f(key)}
                placeholder={placeholder}
                className="border-slate-200 bg-white focus-visible:ring-slate-900/20 h-9 text-sm"
              />
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-slate-900 text-xs">Branch</Label>
            <Input
              value={account.branch}
              onChange={f('branch')}
              placeholder="e.g. Siddiambar Bazar, Hyderabad"
              className="border-slate-200 bg-white focus-visible:ring-slate-900/20 h-9 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [banks, setBanks] = useState<BankAccount[]>(
    initialSettings.bank_accounts.length > 0
      ? initialSettings.bank_accounts
      : [{ ...EMPTY_BANK }]
  )
  const [isSavingBank, startSavingBank] = useTransition()

  const [terms, setTerms] = useState<string[]>(initialSettings.terms_conditions)
  const [isSavingTerms, startSavingTerms] = useTransition()

  const [stampUrl, setStampUrl] = useState(initialSettings.stamp_image_url)
  const [isUploadingStamp, startUploadingStamp] = useTransition()
  const [isDeletingStamp, startDeletingStamp] = useTransition()
  const stampInputRef = useRef<HTMLInputElement>(null)


  function handleBankChange(i: number, field: keyof BankAccount, val: string) {
    setBanks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }
  function handleAddBank() {
    if (banks.length >= MAX_BANK_ACCOUNTS) return
    setBanks(prev => [...prev, { ...EMPTY_BANK }])
  }
  function handleRemoveBank(i: number) {
    setBanks(prev => prev.filter((_, idx) => idx !== i))
  }
  function handleSaveBank() {
    startSavingBank(async () => {
      try {
        await updateSettings({ bank_accounts: banks })
        toast.success('Bank details saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save bank details')
      }
    })
  }

  function handleSaveTerms() {
    const filtered = terms.filter(t => t.trim() !== '')
    startSavingTerms(async () => {
      try {
        await updateSettings({ terms_conditions: filtered })
        setTerms(filtered)
        toast.success('Terms & Conditions saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save terms')
      }
    })
  }

  function handleUploadStamp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    startUploadingStamp(async () => {
      try {
        const url = await uploadStoreAsset('stamp_image_url', fd)
        setStampUrl(url)
        toast.success('Stamp uploaded')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  function handleDeleteStamp() {
    startDeletingStamp(async () => {
      try {
        await updateSettings({ stamp_image_url: '' })
        setStampUrl('')
        toast.success('Stamp removed')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove stamp')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Bank Details */}
      <Card className="border border-slate-200 bg-slate-100">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Bank Details
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Up to {MAX_BANK_ACCOUNTS} accounts — choose per quotation</p>
            </div>
            <span className="text-xs text-slate-500">{banks.length}/{MAX_BANK_ACCOUNTS}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {banks.map((b, i) => (
            <BankAccountCard
              key={i}
              account={b}
              index={i}
              total={banks.length}
              onChange={handleBankChange}
              onRemove={handleRemoveBank}
            />
          ))}
          {banks.length < MAX_BANK_ACCOUNTS && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddBank}
              className="border-slate-300 text-slate-900 hover:bg-slate-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Bank Account
            </Button>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveBank} disabled={isSavingBank} className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white">
              {isSavingBank && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Bank Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card className="border border-slate-200 bg-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            Terms &amp; Conditions
          </CardTitle>
          <p className="text-xs text-slate-500">Shown on quotation PDFs as a bullet list</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {terms.map((term, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-slate-500 text-sm shrink-0">•</span>
              <Input
                value={term}
                onChange={e => setTerms(prev => prev.map((t, i) => i === index ? e.target.value : t))}
                placeholder="Enter term..."
                className="border-slate-200 bg-white focus-visible:ring-slate-900/20 flex-1"
              />
              <Button variant="ghost" size="icon"
                onClick={() => setTerms(prev => prev.filter((_, i) => i !== index))}
                className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setTerms(prev => [...prev, ''])}
            className="border-slate-300 text-slate-900 hover:bg-slate-200">
            <Plus className="w-4 h-4 mr-1" />Add Term
          </Button>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveTerms} disabled={isSavingTerms} className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-white">
              {isSavingTerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Terms
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Stamp */}
      <Card className="border border-slate-200 bg-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            Company Stamp
          </CardTitle>
          <p className="text-xs text-slate-500">Stamp shown on quotation PDFs</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {stampUrl && (
            <div className="border border-slate-200 rounded-md p-2 bg-white inline-block">
              <Image src={stampUrl} alt="Stamp" width={100} height={100} className="object-contain" unoptimized />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={stampInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadStamp} />
            <Button variant="outline" size="sm" onClick={() => stampInputRef.current?.click()}
              disabled={isUploadingStamp} className="border-slate-300 text-slate-900 hover:bg-slate-200">
              {isUploadingStamp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {stampUrl ? 'Replace Stamp' : 'Upload Stamp'}
            </Button>
            {stampUrl && (
              <Button variant="outline" size="sm" onClick={handleDeleteStamp}
                disabled={isDeletingStamp} className="border-red-200 text-red-600 hover:bg-red-50">
                {isDeletingStamp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
