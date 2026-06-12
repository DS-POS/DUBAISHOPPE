'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.getUser()
  if (error || !authData.user) throw new Error('Unauthorized')
  const { data: u } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
  if (u?.role !== 'admin') throw new Error('Admin only')
}

export type CheckStatus = 'pass' | 'issue' | 'error'

export interface CheckResult {
  id: string
  label: string
  description: string
  status: CheckStatus
  count: number
  detail: string
  fixable: boolean
}

// ─── Check 1: DB Connection ────────────────────────────────────────────────
export async function runDbConnectionCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const admin = getAdminClient()
    const { error } = await admin.from('products').select('id').limit(1)
    if (error) throw error
    return {
      id: 'db_connection', label: 'Database Connection',
      description: 'Supabase connection is healthy',
      status: 'pass', count: 0, detail: 'Connected successfully', fixable: false,
    }
  } catch (err) {
    return {
      id: 'db_connection', label: 'Database Connection',
      description: 'Cannot reach database',
      status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

// ─── Check 2: Auth User Sync ───────────────────────────────────────────────
export async function runAuthSyncCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const admin = getAdminClient()
    const { data: { users: authUsers }, error: e1 } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (e1) throw e1

    const authIds = new Set(authUsers.map(u => u.id))
    const { data: pubUsers, error: e2 } = await admin.from('users').select('id')
    if (e2) throw e2

    const pubIds = new Set((pubUsers ?? []).map((u: { id: string }) => u.id))
    const missing = authUsers.filter(u => !pubIds.has(u.id))

    if (missing.length === 0) {
      return {
        id: 'auth_sync', label: 'Auth User Sync',
        description: 'All authenticated users have system profiles',
        status: 'pass', count: 0, detail: `${authIds.size} user(s) all synced`, fixable: false,
      }
    }
    return {
      id: 'auth_sync', label: 'Auth User Sync',
      description: 'Users exist in auth but missing from system',
      status: 'issue', count: missing.length,
      detail: `${missing.length} user(s) missing — causes FK errors on import/invoice`,
      fixable: true,
    }
  } catch (err) {
    return {
      id: 'auth_sync', label: 'Auth User Sync',
      description: 'Check failed', status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

export async function fixAuthSync(): Promise<{ fixed: number }> {
  await assertAdmin()
  const admin = getAdminClient()

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const { data: pubUsers } = await admin.from('users').select('id')
  const pubIds = new Set((pubUsers ?? []).map((u: { id: string }) => u.id))

  const missing = authUsers.filter(u => !pubIds.has(u.id))
  if (missing.length === 0) return { fixed: 0 }

  const rows = missing.map(u => ({
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.name as string | undefined) ?? u.email?.split('@')[0] ?? 'Unknown',
    role: (u.user_metadata?.role as string | undefined) ?? 'staff',
  }))

  const { error } = await admin.from('users').insert(rows)
  if (error) throw new Error(error.message)
  return { fixed: missing.length }
}

// ─── Check 3: Orphaned Supplier Invoices ──────────────────────────────────
export async function runOrphanedInvoicesCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from('supplier_invoices')
      .select('id, total_amount, stock_in(id)')

    if (error) throw error

    type InvRow = { id: string; total_amount: number; stock_in: { id: string }[] }
    const orphaned = (data as InvRow[]).filter(
      inv => !inv.stock_in || inv.stock_in.length === 0
    )

    if (orphaned.length === 0) {
      return {
        id: 'orphaned_invoices', label: 'Supplier Invoice Integrity',
        description: 'All supplier invoices have stock entries',
        status: 'pass', count: 0,
        detail: `${(data ?? []).length} invoice(s) all valid`, fixable: false,
      }
    }
    return {
      id: 'orphaned_invoices', label: 'Supplier Invoice Integrity',
      description: 'Supplier invoices with no stock entries (failed imports)',
      status: 'issue', count: orphaned.length,
      detail: `${orphaned.length} invoice(s) created but stock was never added`,
      fixable: true,
    }
  } catch (err) {
    return {
      id: 'orphaned_invoices', label: 'Supplier Invoice Integrity',
      description: 'Check failed', status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

export async function fixOrphanedInvoices(): Promise<{ fixed: number }> {
  await assertAdmin()
  const admin = getAdminClient()

  const { data } = await admin.from('supplier_invoices').select('id, stock_in(id)')
  type InvRow = { id: string; stock_in: { id: string }[] }
  const orphaned = (data as InvRow[]).filter(
    inv => !inv.stock_in || inv.stock_in.length === 0
  )
  if (orphaned.length === 0) return { fixed: 0 }

  const ids = orphaned.map(inv => inv.id)
  const { error } = await admin.from('supplier_invoices').delete().in('id', ids)
  if (error) throw new Error(error.message)
  return { fixed: ids.length }
}

// ─── Check 4: Negative Stock ──────────────────────────────────────────────
export async function runNegativeStockCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const admin = getAdminClient()
    const { data, error, count } = await admin
      .from('products')
      .select('id, name, current_stock', { count: 'exact' })
      .lt('current_stock', 0)

    if (error) throw error

    const c = count ?? 0
    if (c === 0) {
      return {
        id: 'negative_stock', label: 'Negative Stock',
        description: 'No products have negative stock levels',
        status: 'pass', count: 0, detail: 'All stock levels are valid', fixable: false,
      }
    }
    type PRow = { name: string }
    const preview = (data as PRow[]).slice(0, 3).map(p => p.name).join(', ')
    return {
      id: 'negative_stock', label: 'Negative Stock',
      description: 'Products with negative stock (needs manual review)',
      status: 'issue', count: c,
      detail: `${c} product(s): ${preview}${c > 3 ? '…' : ''}`,
      fixable: false,
    }
  } catch (err) {
    return {
      id: 'negative_stock', label: 'Negative Stock',
      description: 'Check failed', status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

// ─── Check 5: Email Configuration ────────────────────────────────────────
export async function runEmailConfigCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return {
        id: 'email_config', label: 'Email Configuration',
        description: 'RESEND_API_KEY is not set — invoice emails will fail',
        status: 'error', count: 0,
        detail: 'Set RESEND_API_KEY in environment variables to enable email sending',
        fixable: false,
      }
    }
    if (!apiKey.startsWith('re_')) {
      return {
        id: 'email_config', label: 'Email Configuration',
        description: 'RESEND_API_KEY format looks invalid (should start with re_)',
        status: 'issue', count: 0,
        detail: 'Verify key at resend.com/api-keys',
        fixable: false,
      }
    }
    return {
      id: 'email_config', label: 'Email Configuration',
      description: 'Resend API key is set and format is valid',
      status: 'pass', count: 0,
      detail: 'Key present with correct re_ prefix — email sending should be operational',
      fixable: false,
    }
  } catch (err) {
    return {
      id: 'email_config', label: 'Email Configuration',
      description: 'Check failed', status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

// ─── Check 6: Environment Variables ──────────────────────────────────────
export async function runEnvVarsCheck(): Promise<CheckResult> {
  await assertAdmin()
  try {
    const required: { key: string; label: string }[] = [
      { key: 'NEXT_PUBLIC_SUPABASE_URL',      label: 'Supabase URL' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY',     label: 'Supabase Service Role Key' },
      { key: 'RESEND_API_KEY',                label: 'Resend Email Key' },
      { key: 'NEXT_PUBLIC_APP_URL',           label: 'App URL' },
    ]

    const missing = required.filter(r => {
      const val = process.env[r.key]
      return !val || val.trim() === ''
    })

    if (missing.length === 0) {
      return {
        id: 'env_vars', label: 'Environment Variables',
        description: 'All required environment variables are set',
        status: 'pass', count: 0,
        detail: `${required.length} variables verified — no missing config`,
        fixable: false,
      }
    }

    return {
      id: 'env_vars', label: 'Environment Variables',
      description: `${missing.length} required variable${missing.length > 1 ? 's' : ''} missing — causes "Server Components render error"`,
      status: 'error', count: missing.length,
      detail: `Missing: ${missing.map(m => m.label).join(', ')} — add to Vercel → Settings → Environment Variables`,
      fixable: false,
    }
  } catch (err) {
    return {
      id: 'env_vars', label: 'Environment Variables',
      description: 'Check failed', status: 'error', count: 0, detail: String(err), fixable: false,
    }
  }
}

// ─── Run All ──────────────────────────────────────────────────────────────
export async function runAllChecks(): Promise<CheckResult[]> {
  const [db, authSync, orphaned, negStock, emailConfig, envVars] = await Promise.all([
    runDbConnectionCheck(),
    runAuthSyncCheck(),
    runOrphanedInvoicesCheck(),
    runNegativeStockCheck(),
    runEmailConfigCheck(),
    runEnvVarsCheck(),
  ])
  return [db, authSync, orphaned, negStock, emailConfig, envVars]
}
