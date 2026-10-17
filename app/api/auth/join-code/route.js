// app/api/auth/join-code/route.js - Gabung / Masuk menggunakan Kode Khusus Keluarga + Username + Password/PIN

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signToken, createSessionCookie } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { generateUsernameSuggestions } from '@/lib/email'
import { logActivity } from '@/lib/logger'
import { AVATAR_COLORS } from '@/lib/constants'

export async function POST(request) {
  try {
    const clientIp = getClientIp(request)
    // Proteksi brute-force tebak kode undangan: Maks 8 percobaan per 3 menit per IP
    const rateCheck = checkRateLimit(`join-code:${clientIp}`, 8, 180000)
    if (!rateCheck.success) {
      const waitSec = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000))
      return NextResponse.json(
        {
          errorKey: 'rate_limit',
          error: `Terlalu banyak percobaan. Harap tunggu ${waitSec} detik demi keamanan.`,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { inviteCode, memberName, username } = body
    const rawName = memberName || username || ''
    const pin = body.pin || body.password || ''

    if (!inviteCode || !inviteCode.trim() || !rawName.trim() || !String(pin).trim()) {
      return NextResponse.json(
        {
          errorKey: 'required_field',
          error: 'Kode Khusus Keluarga, Username/Nama Panggilan, dan Password/PIN wajib diisi.',
        },
        { status: 400 }
      )
    }

    const cleanCode = inviteCode.trim().toUpperCase()
    const cleanName = rawName.trim()
    const cleanPin = String(pin)

    if (cleanName.length < 2) {
      return NextResponse.json(
        { errorKey: 'name_too_short', error: 'Username / Nama panggilan minimal 2 karakter.' },
        { status: 400 }
      )
    }

    if (cleanPin.length < 4) {
      return NextResponse.json(
        { errorKey: 'password_too_short', error: 'Password / PIN minimal 4 karakter.' },
        { status: 400 }
      )
    }

    // 1. Cari keluarga berdasarkan inviteCode
    const family = await prisma.appSettings.findFirst({
      where: {
        inviteCode: cleanCode,
      },
    })

    if (!family) {
      return NextResponse.json(
        {
          errorKey: 'invalid_invite_code',
          error: 'Kode Khusus Keluarga tidak ditemukan atau sudah diganti oleh Superadmin.',
        },
        { status: 404 }
      )
    }

    // 2. Cek apakah username sudah ada di keluarga ini (Auto-Recognize jika password cocok)
    const familyMembers = await prisma.member.findMany({
      where: { familyId: family.id },
    })

    let member = familyMembers.find(
      m => m.name.trim().toLowerCase() === cleanName.toLowerCase()
    )

    let isNewMember = false

    if (member) {
      // Cek kecocokan password/PIN untuk member yang sudah terdaftar di keluarga ini
      const isPasswordValid = await bcrypt.compare(cleanPin, member.pin)
      if (!isPasswordValid) {
        const suggestions = await generateUsernameSuggestions(cleanName)
        return NextResponse.json(
          {
            errorKey: 'username_taken_or_wrong_pin',
            error: `Username "${member.name}" sudah terdaftar di keluarga ini namun Password/PIN tidak cocok. Jika ini akun Anda, masukkan Password/PIN yang benar (atau masuk lewat tab "Masuk"). Jika Anda anggota baru, pilih saran username unik:`,
            suggestions,
          },
          { status: 409 }
        )
      }

      if (!member.isActive) {
        return NextResponse.json(
          {
            errorKey: 'member_inactive',
            error: `Profil anggota "${member.name}" sedang dinonaktifkan oleh Superadmin keluarga.`,
          },
          { status: 403 }
        )
      }
    } else {
      // 3. Cek apakah username sudah dipakai secara global (agar saat nanti login di Tab 1 tidak bentrok)
      const allMatchingMembers = await prisma.member.findMany({
        where: { name: cleanName },
      })
      const existingGlobal = allMatchingMembers.find(
        m => m.name.trim().toLowerCase() === cleanName.toLowerCase()
      )

      if (existingGlobal) {
        const suggestions = await generateUsernameSuggestions(cleanName)
        return NextResponse.json(
          {
            errorKey: 'username_taken',
            error: `Username "${cleanName}" sudah digunakan. Pilih salah satu saran username unik berikut agar Anda bisa login kembali kapan saja:`,
            suggestions,
          },
          { status: 409 }
        )
      }

      // 4. Cek kuota anggota aktif di keluarga ini (maks 5 anggota aktif)
      const activeCount = familyMembers.filter(m => m.isActive).length
      if (activeCount >= 5) {
        return NextResponse.json(
          {
            errorKey: 'family_quota_full',
            error: 'Kuota anggota di Cash Book keluarga ini sudah penuh (maksimal 5 anggota aktif). Hubungi Superadmin keluarga Anda.',
          },
          { status: 400 }
        )
      }

      // 5. Buat akun member baru secara otomatis dengan Password/PIN pilihan user sendiri
      const pinHash = await bcrypt.hash(cleanPin, 10)
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].value

      member = await prisma.member.create({
        data: {
          familyId: family.id,
          name: cleanName,
          pin: pinHash,
          role: 'member',
          emailVerified: true,
          avatarColor: randomColor,
          isActive: true,
        },
      })
      isNewMember = true
    }

    // 6. Catat di Activity Log keluarga tersebut secara non-blocking agar respon login instan
    logActivity({
      familyId: family.id,
      action: isNewMember ? 'MEMBER_CREATE' : 'MEMBER_LOGIN_CODE',
      description: isNewMember
        ? `${member.name} bergabung ke Cash Book "${family.familyName}" menggunakan Kode Khusus Keluarga`
        : `${member.name} masuk kembali ke Cash Book "${family.familyName}" menggunakan Kode Khusus Keluarga`,
      details: { id: member.id, name: member.name, joinedViaCode: true, isNewMember },
      memberId: member.id,
    }).catch(() => {})

    // 7. Langsung login otomatis ke Cash Book keluarga tersebut
    const token = await signToken({
      id: member.id,
      name: member.name,
      role: member.role,
      avatarColor: member.avatarColor,
      familyId: family.id,
    })

    const cookieOptions = createSessionCookie(token)
    const response = NextResponse.json(
      {
        success: true,
        isNewMember,
        familyName: family.familyName,
        user: {
          id: member.id,
          name: member.name,
          role: member.role,
          avatarColor: member.avatarColor,
          familyId: family.id,
        },
      },
      { status: isNewMember ? 201 : 200 }
    )

    response.cookies.set(cookieOptions)
    return response
  } catch (error) {
    console.error('Join by code error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server: ' + (error.message || String(error)) },
      { status: 500 }
    )
  }
}
