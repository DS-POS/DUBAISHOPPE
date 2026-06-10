import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode  // action buttons go here
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
