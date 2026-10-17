// app/api/auth/login/route.js - Login API (Multi-Family Aware)

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signToken, createSessionCookie } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    const clientIp = getClientIp(request)
    // Proteksi brute force & bcrypt CPU exhaustion: Max 5 percobaan login per menit per IP
    const rateCheck = checkRateLimit(`login:${clientIp}`, 5, 60000)
    if (!rateCheck.success) {
      const waitSec = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000))
      return NextResponse.json(
        { error: `Terlalu banyak percobaan login. Harap tunggu ${waitSec} detik demi keamanan.` },
        { 
          status: 429,
          headers: {
            'Retry-After': String(waitSec),
            'X-RateLimit-Limit': String(rateCheck.total),
            'X-RateLimit-Remaining': '0',
          }
        }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Format pesan tidak valid' }, { status: 400 })
    }
    
    const { name, pin } = body

    if (!name || !pin) {
      return NextResponse.json(
        { error: 'Username dan Password wajib diisi' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    // Cari kandidat member berdasarkan username atau email
    const candidates = await prisma.member.findMany({
      where: {
        OR: [
          { name: trimmedName },
          { email: trimmedName.toLowerCase() },
        ],
        isActive: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan atau tidak aktif. Pastikan username sudah terdaftar.' },
        { status: 401 }
      )
    }

    // Verifikasi PIN / Password terhadap kandidat yang cocok
    let matchedMember = null
    for (const candidate of candidates) {
      const isPinValid = await bcrypt.compare(String(pin), candidate.pin)
      if (isPinValid) {
        matchedMember = candidate
        break
      }
    }

    if (!matchedMember) {
      return NextResponse.json(
        { error: 'Password salah' },
        { status: 401 }
      )
    }

    const familyId = matchedMember.familyId || '1'

    // Generate JWT token & ambil nama keluarga secara paralel
    const [token, settings] = await Promise.all([
      signToken({
        id: matchedMember.id,
        name: matchedMember.name,
        role: matchedMember.role,
        avatarColor: matchedMember.avatarColor,
        familyId,
      }),
      prisma.appSettings.findUnique({
        where: { id: familyId },
        select: { familyName: true },
      }),
    ])

    // Set cookie
    const cookieOptions = createSessionCookie(token)
    const response = NextResponse.json({
      success: true,
      familyName: settings?.familyName || 'Cash Book',
      user: {
        id: matchedMember.id,
        name: matchedMember.name,
        role: matchedMember.role,
        avatarColor: matchedMember.avatarColor,
        familyId,
      },
    })

    response.cookies.set(cookieOptions)
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server: ' + (error.message || String(error)) },
      { status: 500 }
    )
  }
}
