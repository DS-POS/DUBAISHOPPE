'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BankAccount, StoreSettings } from '@/lib/settings-types'

export type { BankAccount, StoreSettings }

const DEFAULT_TERMS: string[] = [
  'Prices are quoted in INR.',
  'This quotation is valid for today only. From tomorrow, prices for camera bodies and lenses are subject to change based on availability.',
  'Full payment to be made before delivery.',
  'Goods once sold are not returnable.',
  'Subject to availability of stock.',
]

export async function getSettings(): Promise<StoreSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'bank_accounts',
      // legacy single-bank keys (for migration)
      'bank_name', 'bank_account_name', 'bank_account_number', 'bank_ifsc', 'bank_branch',
      'terms_conditions',
      'stamp_image_url',
      'signature_image_url',
    ])

  if (error) console.error('getSettings error:', error)

  const map: Record<string, string> = {}
  if (data) {
    for (const row of data) map[row.key] = row.value ?? ''
  }

  // Bank accounts — try new format first, fall back to legacy single bank
  let bankAccounts: BankAccount[] = []
  if (map['bank_accounts']) {
    try {
      const parsed = JSON.parse(map['bank_accounts'])
      if (Array.isArray(parsed)) bankAccounts = parsed as BankAccount[]
    } catch { /* ignore */ }
  }
  // Migrate legacy single-bank fields if new format empty
  if (bankAccounts.length === 0 && map['bank_name']) {
    bankAccounts = [{
      bank_name: map['bank_name'],
      account_name: map['bank_account_name'] ?? '',
      account_number: map['bank_account_number'] ?? '',
      ifsc: map['bank_ifsc'] ?? '',
      branch: map['bank_branch'] ?? '',
    }]
  }

  let terms: string[] = DEFAULT_TERMS
  if (map['terms_conditions']) {
    try {
      const parsed = JSON.parse(map['terms_conditions'])
      if (Array.isArray(parsed)) terms = parsed as string[]
    } catch { terms = DEFAULT_TERMS }
  }

  return {
    bank_accounts: bankAccounts,
    terms_conditions: terms,
    stamp_image_url: map['stamp_image_url'] ?? '',
    signature_image_url: map['signature_image_url'] ?? '',
  }
}

export async function updateSettings(data: Partial<StoreSettings>): Promise<void> {
  const supabase = await createClient()
  const upserts: { key: string; value: string; updated_at: string }[] = []
  const now = new Date().toISOString()

  if (data.bank_accounts !== undefined) {
    upserts.push({ key: 'bank_accounts', value: JSON.stringify(data.bank_accounts), updated_at: now })
  }
  if (data.terms_conditions !== undefined) {
    upserts.push({ key: 'terms_conditions', value: JSON.stringify(data.terms_conditions), updated_at: now })
  }
  if (data.stamp_image_url !== undefined) {
    upserts.push({ key: 'stamp_image_url', value: data.stamp_image_url, updated_at: now })
  }
  if (data.signature_image_url !== undefined) {
    upserts.push({ key: 'signature_image_url', value: data.signature_image_url, updated_at: now })
  }

  if (upserts.length === 0) return

  const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
  if (error) throw new Error(`Failed to save settings: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/quotations')
}

export async function uploadStoreAsset(
  field: 'stamp_image_url' | 'signature_image_url',
  formData: FormData
): Promise<string> {
  const supabase = await createClient()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) throw new Error('No file provided')

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `store/${field}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('store-assets')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from('store-assets').getPublicUrl(path)
  await updateSettings({ [field]: urlData.publicUrl } as Partial<StoreSettings>)

  return urlData.publicUrl
}

