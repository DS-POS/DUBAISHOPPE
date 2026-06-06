import Link from 'next/link'
import { TagIcon } from 'lucide-react'

export function LabelsQuickWidget() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <TagIcon className="size-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Label Printer</p>
          <p className="text-xs text-slate-500">Print barcode labels</p>
        </div>
      </div>
      <Link href="/labels" className="text-xs font-semibold text-blue-600 hover:underline">Open →</Link>
    </div>
  )
}
