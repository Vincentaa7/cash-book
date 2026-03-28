// app/api/auth/logout/route.js - Logout API

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  const cookieOptions = clearSessionCookie()
  const response = NextResponse.json({ success: true })
  response.cookies.set(cookieOptions)
  return response
}
