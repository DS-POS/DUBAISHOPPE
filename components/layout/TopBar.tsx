'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import type { User } from '@/types/database'

export default function TopBar({ user }: { user: User | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div
      className="h-14 border-b border-slate-200/70 flex items-center justify-between px-4 md:px-6 pl-16 md:pl-6 flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="text-sm">
        <span className="font-bold text-slate-800 tracking-tight">Dubai Shoppe</span>
        {user?.role === 'admin' && (
          <span className="ml-2 text-[10px] bg-[#111827] text-white px-1.5 py-0.5 rounded-md font-semibold tracking-wide">ADMIN</span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2.5 rounded-xl hover:bg-slate-100/80 transition-all duration-150 outline-none">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-[#111827] text-white text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user?.name || 'User'}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="shadow-lg border-slate-200">
          <DropdownMenuItem disabled className="text-xs text-slate-500">{user?.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
