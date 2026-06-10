'use client'

import { useState } from 'react'
import { AddStaffDialog } from './AddStaffDialog'
import { UserPlusIcon } from 'lucide-react'

export function AddStaffButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
      >
        <UserPlusIcon className="size-4" />
        Add Staff
      </button>
      {open && <AddStaffDialog onClose={() => setOpen(false)} />}
    </>
  )
}
