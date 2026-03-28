// app/layout.jsx - Root Layout

import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cash Book - Buku Keuangan Keluarga',
  description: 'Aplikasi manajemen keuangan keluarga digital. Catat pengeluaran, pantau kas bulanan, dan buat laporan keuangan dengan mudah.',
  keywords: 'buku kas, keuangan keluarga, pengeluaran, anggaran, manajemen keuangan',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d9488',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="application-name" content="Cash Book" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
