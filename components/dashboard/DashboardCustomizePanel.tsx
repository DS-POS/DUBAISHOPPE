'use client'
import { useEffect, useState } from 'react'
import { X, LayoutGrid, RotateCcw } from 'lucide-react'
import { WIDGET_DEFS, type WidgetId } from './useDashboardWidgets'

interface Props {
  visible: Record<WidgetId, boolean>
  toggle: (id: WidgetId) => void
  resetAll: () => void
}

export function DashboardCustomizePanel({ visible, toggle, resetAll }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function handleOpen() { setIsOpen(true) }
    window.addEventListener('ds-customize-dashboard', handleOpen)
    return () => window.removeEventListener('ds-customize-dashboard', handleOpen)
  }, [])

  if (!isOpen) return null

  const activeWidgets = WIDGET_DEFS.filter(w => visible[w.id])
  const hiddenWidgets = WIDGET_DEFS.filter(w => !visible[w.id])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="size-4 text-white" />
            <h2 className="text-sm font-bold text-white">Customize Dashboard</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Active widgets */}
          {activeWidgets.length > 0 && (
            <div className="px-4 py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Visible ({activeWidgets.length})
              </p>
              <div className="space-y-2">
                {activeWidgets.map(w => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{w.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{w.desc}</p>
                    </div>
                    {/* Toggle ON */}
                    <button
                      onClick={() => toggle(w.id)}
                      title="Hide widget"
                      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-blue-600 transition-colors"
                    >
                      <span className="inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden widgets — Add section */}
          {hiddenWidgets.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Add Widget
              </p>
              <div className="space-y-2">
                {hiddenWidgets.map(w => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50"
                  >
                    <div className="min-w-0 flex-1 opacity-60">
                      <p className="text-sm font-semibold text-slate-700 leading-tight">{w.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{w.desc}</p>
                    </div>
                    {/* Toggle OFF */}
                    <button
                      onClick={() => toggle(w.id)}
                      title="Show widget"
                      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition-colors hover:bg-slate-400"
                    >
                      <span className="inline-block h-3.5 w-3.5 translate-x-1 rounded-full bg-white shadow transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeWidgets.length === 0 && hiddenWidgets.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No widgets available.</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => { resetAll(); setIsOpen(false) }}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800 py-2 rounded-xl hover:bg-slate-100 transition-colors font-medium"
          >
            <RotateCcw className="size-3.5" />
            Reset to Default
          </button>
        </div>
      </div>
    </>
  )
}
