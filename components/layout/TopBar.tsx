'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import type { User } from '@/types/database'

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  admin: { label: 'ADMIN', bg: '#0f172a', text: '#ffffff' },
  manager: { label: 'MANAGER', bg: '#1d4ed8', text: '#ffffff' },
  staff: { label: 'STAFF', bg: '#475569', text: '#ffffff' },
}

export default function TopBar({ user }: { user: User | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  const roleConfig = user?.role ? ROLE_CONFIG[user.role] ?? ROLE_CONFIG.staff : null

  return (
    <div
      className="h-14 border-b flex items-center justify-between px-4 md:px-6 flex-shrink-0 gap-2"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'rgba(226,232,240,0.8)',
        boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="h-7 w-auto object-contain shrink-0" style={{ clipPath: 'inset(0 0 24% 0)' }} />
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-800 tracking-tight text-sm truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>Dubai Shoppe</span>
          {roleConfig && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-wider shrink-0 hidden sm:inline"
              style={{ background: roleConfig.bg, color: roleConfig.text }}
            >
              {roleConfig.label}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2.5 rounded-xl hover:bg-slate-100/80 transition-all duration-150 outline-none shrink-0">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold text-slate-700 hidden sm:inline truncate max-w-[100px]">{user?.name || 'User'}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="shadow-lg border-slate-200 rounded-xl min-w-[160px]">
          <DropdownMenuItem disabled className="text-xs text-slate-500 font-medium">{user?.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer font-medium">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
