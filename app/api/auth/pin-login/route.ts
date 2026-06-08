import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { profileId, pin } = await req.json()

    if (!profileId || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch profile with pin_hash and email
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, is_active, pin_hash, email')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
    }

    if (!profile.pin_hash) {
      return NextResponse.json({ error: 'PIN not set. Contact admin.' }, { status: 403 })
    }

    if (!profile.email) {
      return NextResponse.json({ error: 'Account not properly configured. Contact admin.' }, { status: 403 })
    }

    // Verify PIN
    const valid = await bcrypt.compare(pin, profile.pin_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
    }

    // Generate a magic link to get a one-time token
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    })

    if (linkError || !linkData?.properties?.email_otp) {
      console.error('generateLink failed:', linkError)
      return NextResponse.json({ error: 'Login failed. Try again.' }, { status: 500 })
    }

    // Use SSR client to verify the OTP — this sets session cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: profile.email,
      token: linkData.properties.email_otp,
      type: 'magiclink',
    })

    if (verifyError) {
      console.error('verifyOtp failed:', verifyError)
      return NextResponse.json({ error: 'Login failed. Try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PIN login error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
