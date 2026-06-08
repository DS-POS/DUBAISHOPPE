import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Check email exists in profiles
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, is_active')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (profileError || !profile) {
      // Return success anyway to avoid email enumeration
      return NextResponse.json({ success: true })
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account is inactive. Contact admin.' }, { status: 403 })
    }

    const origin = req.headers.get('origin') || 'https://ds-pos.vercel.app'

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

    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/set-pin`,
        shouldCreateUser: false,
      },
    })

    if (error) {
      console.error('OTP send error:', error)
      return NextResponse.json({ error: 'Failed to send email. Try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-pin-reset error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
