// middleware.js - Route Protection
// Redirect ke /login jika belum autentikasi

import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const COOKIE_NAME = 'cash-book-session'

// Route yang tidak butuh autentikasi
const PUBLIC_ROUTES = ['/login']
// Route yang butuh role admin
const ADMIN_ROUTES = ['/pengaturan']

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  // Cek apakah route publik
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Root redirect ke dashboard atau login
  if (pathname === '/') {
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Proteksi semua route non-publik
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }

  // Cek akses admin
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route))
  if (isAdminRoute && payload.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Tambahkan info user ke header untuk diakses di server components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', payload.id)
  requestHeaders.set('x-user-name', payload.name)
  requestHeaders.set('x-user-role', payload.role)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons).*)',
  ],
}
