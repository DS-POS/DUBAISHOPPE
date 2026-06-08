'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function setMyPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const bcrypt = await import('bcryptjs')
  const pin_hash = await bcrypt.hash(pin, 10)

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({ pin_hash })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
}

export async function createStaffUser(data: {
  name: string
  email: string
  role: UserRole
  pin: string
  recovery_password: string
}): Promise<void> {
  await requireAdmin()

  if (!/^\d{4}$/.test(data.pin)) throw new Error('PIN must be 4 digits')
  if (data.recovery_password.length < 8) throw new Error('Recovery password must be 8+ characters')

  const adminClient = createAdminClient()

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.recovery_password,
    email_confirm: true,
    user_metadata: { name: data.name },
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Failed to create auth user')
  }

  const userId = authData.user.id

  const bcrypt = await import('bcryptjs')
  const pin_hash = await bcrypt.hash(data.pin, 10)

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      name: data.name,
      email: data.email,
      role: data.role,
      is_active: true,
      pin_hash,
    })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId)
    throw new Error(profileError.message)
  }

  revalidatePath('/settings/users')
}

export async function resetStaffPin(userId: string, newPin: string): Promise<void> {
  await requireAdmin()

  if (!/^\d{4}$/.test(newPin)) throw new Error('PIN must be 4 digits')

  const bcrypt = await import('bcryptjs')
  const pin_hash = await bcrypt.hash(newPin, 10)

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({ pin_hash })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}
