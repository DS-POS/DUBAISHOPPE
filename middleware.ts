import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_PAGES = ['/login', '/forgot-pin', '/forgot-password', '/reset-password']
// NOTE: /set-pin is intentionally excluded — it requires auth

const ROLE_RESTRICTIONS: Record<string, string[]> = {
  '/settings': ['admin'],
  '/reports/tally': ['admin'],
  '/stock-adjustments': ['admin', 'manager'],
  '/suppliers': ['admin', 'manager'],
  '/purchase-orders': ['admin', 'manager'],
  '/labels': ['admin', 'manager'],
  '/reports': ['admin', 'manager'],
  '/expenses': ['admin', 'manager'],
  '/store-loans': ['admin', 'manager'],
  '/stock-in': ['admin', 'manager'],
  '/products': ['admin', 'manager'],
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p))

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user) {
    const matchedPath = Object.keys(ROLE_RESTRICTIONS).find(p => pathname.startsWith(p))
    if (matchedPath) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role as string) ?? 'staff'
      const allowed = ROLE_RESTRICTIONS[matchedPath]

      if (!allowed.includes(role)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
