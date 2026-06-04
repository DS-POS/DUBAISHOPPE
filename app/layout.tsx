import type { Metadata, Viewport } from 'next'
import { Rubik, Nunito_Sans } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

// Browser-only: IndexedDB + SW registration must never run server-side
const OfflineBanner = dynamic(() => import('@/components/offline/OfflineBanner').then(m => m.OfflineBanner), { ssr: false })
const ServiceWorkerRegister = dynamic(() => import('@/components/offline/ServiceWorkerRegister').then(m => m.ServiceWorkerRegister), { ssr: false })

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-rubik',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: 'DS POS — Dubai Shoppe',
  description: 'Point of Sale System for Dubai Shoppe',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DS POS' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rubik.variable} ${nunitoSans.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
        <OfflineBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
