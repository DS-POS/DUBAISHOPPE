'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Profile, UserRole } from '@/types/database'
import { requireAdmin } from '@/lib/get-user-role'
import { randomUUID, randomBytes } from 'crypto'

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
    .update({ role, is_active: true })
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
}): Promise<{ error?: string }> {
  try {
    await requireAdmin()

    if (!/^\d{4}$/.test(data.pin)) return { error: 'PIN must be 4 digits' }

    const adminClient = createAdminClient()
    const randomPassword = randomBytes(24).toString('base64') + 'Aa1!'

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email.toLowerCase().trim(),
      password: randomPassword,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return { error: `[auth] ${authError?.message ?? 'Failed to create auth user'} | status=${authError?.status} code=${(authError as unknown as Record<string, unknown>)?.code ?? 'none'}` }
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
      return { error: `[profile] ${profileError.message}` }
    }

    revalidatePath('/settings/users')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create staff' }
  }
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
