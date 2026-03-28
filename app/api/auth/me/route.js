// app/api/auth/me/route.js - Get current user info

import { NextResponse } from 'next/server'
import { getSession, clearSessionCookie } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const member = await prisma.member.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, role: true, avatarColor: true, isActive: true },
    })

    if (!member || !member.isActive) {
      const cookieOptions = clearSessionCookie()
      const response = NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
      response.cookies.set(cookieOptions)
      return response
    }

    return NextResponse.json({ user: member })
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
