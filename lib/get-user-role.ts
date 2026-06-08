import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as UserRole) ?? 'staff'
}

export async function requireAdmin(): Promise<void> {
  const role = await getUserRole()
  if (role !== 'admin') throw new Error('Admin access required')
}

export async function requireRole(allowed: UserRole[]): Promise<void> {
  const role = await getUserRole()
  if (!role || !allowed.includes(role)) throw new Error('Access denied')
}
