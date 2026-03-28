// app/api/auth/login/route.js - Login API

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signToken, createSessionCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Format pesan tidak valid' }, { status: 400 })
    }
    console.log('[LOGIN] Payload diterima:', body)
    
    const { name, pin } = body

    if (!name || !pin) {
      return NextResponse.json(
        { error: 'Nama dan PIN wajib diisi' },
        { status: 400 }
      )
    }

    // Cari member berdasarkan nama (case-insensitive pada MySQL default)
    const member = await prisma.member.findFirst({
      where: {
        name: name,
        isActive: true,
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Nama anggota tidak ditemukan atau tidak aktif' },
        { status: 401 }
      )
    }

    // Verifikasi PIN
    const isPinValid = await bcrypt.compare(pin, member.pin)
    if (!isPinValid) {
      return NextResponse.json(
        { error: 'PIN salah' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const token = await signToken({
      id: member.id,
      name: member.name,
      role: member.role,
      avatarColor: member.avatarColor,
    })

    // Set cookie
    const cookieOptions = createSessionCookie(token)
    const response = NextResponse.json({
      success: true,
      user: {
        id: member.id,
        name: member.name,
        role: member.role,
        avatarColor: member.avatarColor,
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
