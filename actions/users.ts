'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Profile, UserRole } from '@/types/database'
import { requireAdmin } from '@/lib/get-user-role'

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()

  if (role === 'staff') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    if ((admins ?? []).length <= 1) throw new Error('Cannot remove the last admin.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === userId) throw new Error('Cannot deactivate your own account.')

  if (!isActive) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (targetProfile?.role === 'admin') {
      const { data: activeAdmins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
      if ((activeAdmins ?? []).length <= 1) throw new Error('Cannot deactivate the last active admin.')
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}
