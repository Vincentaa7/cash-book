// app/layout.jsx - Root Layout (Clean Fintech Typography: Plus Jakarta Sans)

import './globals.css'
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  title: 'Cash Book — Buku Keuangan Keluarga',
  description: 'Aplikasi manajemen keuangan keluarga digital. Catat pengeluaran, pantau kas bulanan, dan buat laporan keuangan dengan presisi.',
  keywords: 'buku kas, keuangan keluarga, pengeluaran, anggaran, manajemen keuangan',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cash Book',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d9488',
}

import { LanguageProvider } from '@/components/LanguageContext'
import { UserProvider } from '@/components/UserContext'
import { ToastProvider } from '@/components/ToastContext'
import PwaRegister from '@/components/PwaRegister'

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="application-name" content="Cash Book" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={plusJakartaSans.className}>
        <LanguageProvider>
          <UserProvider>
            <ToastProvider>
              {children}
              <PwaRegister />
            </ToastProvider>
          </UserProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
