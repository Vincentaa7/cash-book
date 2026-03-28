import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'cash-book-secret-key-change-in-production'
const secretKey = new TextEncoder().encode(JWT_SECRET)
const COOKIE_NAME = 'cash-book-session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 hari

/**
 * Generate JWT token untuk member
 */
export async function signToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secretKey)
}

/**
 * Verify dan decode JWT token
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey)
    return payload
  } catch (error) {
    console.error('[JWT VERIFY ERROR]', error)
    return null
  }
}

/**
 * Ambil session dari cookie request headers
 * Catatan: Fungsi ini hanya bisa dipanggil di Server Components/API Routes, 
 * BUKAN di Middleware karena keterbatasan Edge Runtime.
 */
export async function getSession() {
  try {
    // Gunakan require dinamis agar tidak merusak build Middleware (Edge Runtime)
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const payload = await verifyToken(token)
    return payload
  } catch {
    return null
  }
}

/**
 * Set session cookie setelah login
 */
export function createSessionCookie(token) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}

/**
 * Clear session cookie saat logout
 */
export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME
