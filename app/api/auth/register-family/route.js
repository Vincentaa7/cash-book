// app/api/auth/register-family/route.js - Pendaftaran Cash Book Keluarga Baru (Superadmin) + Verifikasi Email OTP

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import prisma from '@/lib/db'
import { signToken, createSessionCookie } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import {
  validateActiveEmail,
  generateInviteCode,
  generateOtpCode,
  generateUsernameSuggestions,
  sendVerificationOtpEmail,
} from '@/lib/email'
import { logActivity } from '@/lib/logger'
import { AVATAR_COLORS } from '@/lib/constants'

export async function POST(request) {
  try {
    const clientIp = getClientIp(request)
    const body = await request.json()
    const rawAction = body.action || body.step || 'request_otp'
    const action = rawAction === 'request-otp' ? 'request_otp' : rawAction === 'verify-otp' ? 'verify_otp' : rawAction

    // =========================================================================
    // TAHAP 1: REQUEST OTP KE EMAIL AKTIF (Anti-Spam, Anti-Disposable, Anti-DDoS)
    // =========================================================================
    if (action === 'request_otp') {
      // Rate limit ketat per IP: maks 4 request OTP per 10 menit
      const ipRate = checkRateLimit(`reg-otp-ip:${clientIp}`, 4, 10 * 60 * 1000)
      if (!ipRate.success) {
        const waitSec = Math.max(1, Math.ceil((ipRate.resetTime - Date.now()) / 1000))
        return NextResponse.json(
          {
            errorKey: 'rate_limit',
            error: `Terlalu banyak permintaan kode verifikasi. Tunggu ${waitSec} detik demi keamanan.`,
          },
          { status: 429 }
        )
      }

      const { email, username, familyName, avatarColor } = body
      const pin = body.pin || body.password

      if (!email || !pin || !familyName) {
        return NextResponse.json(
          { errorKey: 'required_field', error: 'Semua kolom wajib diisi.' },
          { status: 400 }
        )
      }

      const cleanFamilyName = familyName.trim()

      if (String(pin).length < 4) {
        return NextResponse.json(
          { errorKey: 'password_too_short', error: 'Password minimal 4 karakter.' },
          { status: 400 }
        )
      }

      // 1. Validasi keaktifan email & blokir domain email sementara/fiktif (temp-mail)
      const emailCheck = validateActiveEmail(email)
      if (!emailCheck.valid) {
        const msg =
          emailCheck.reason === 'disposable_email'
            ? 'Email sementara/fiktif tidak diizinkan. Gunakan email aktif resmi (Gmail, Yahoo, Outlook, dll).'
            : 'Format alamat email tidak valid.'
        return NextResponse.json(
          { errorKey: emailCheck.reason, error: msg },
          { status: 400 }
        )
      }

      const cleanEmail = emailCheck.email

      // Rate limit per alamat email: maks 3 pengiriman per 10 menit
      const emailRate = checkRateLimit(`reg-otp-email:${cleanEmail}`, 3, 10 * 60 * 1000)
      if (!emailRate.success) {
        const waitSec = Math.max(1, Math.ceil((emailRate.resetTime - Date.now()) / 1000))
        return NextResponse.json(
          {
            errorKey: 'rate_limit',
            error: `Kode OTP baru saja dikirim ke email ini. Tunggu ${waitSec} detik sebelum meminta ulang.`,
          },
          { status: 429 }
        )
      }

      // 2. Cek apakah email sudah terdaftar di Member
      const existingEmail = await prisma.member.findFirst({
        where: { email: cleanEmail },
      })
      if (existingEmail) {
        return NextResponse.json(
          {
            errorKey: 'email_taken',
            error: 'Alamat email ini sudah terdaftar. Silakan masuk melalui tab Masuk.',
          },
          { status: 409 }
        )
      }

      // 3. Tentukan nama profil Superadmin otomatis dari prefix email (jika kolom username tidak ditampilkan)
      let cleanUsername = (username && username.trim()) || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '') || 'superadmin'
      if (cleanUsername.length < 3) {
        cleanUsername = `${cleanUsername}_admin`
      }

      const existingUsername = await prisma.member.findFirst({
        where: { name: cleanUsername },
      })
      if (existingUsername) {
        const suggestions = await generateUsernameSuggestions(cleanUsername)
        if (username && username.trim()) {
          return NextResponse.json(
            {
              errorKey: 'username_taken',
              error: `Username "${cleanUsername}" sudah digunakan oleh pengguna lain. Pilih salah satu saran unik:`,
              suggestions,
            },
            { status: 409 }
          )
        }
        // Jika digenerate otomatis dari email, langsung gunakan nama unik pertama yang tersedia
        cleanUsername = suggestions[0] || `${cleanUsername}_${Math.floor(100 + Math.random() * 900)}`
      }

      // 4. Generate OTP 6 digit & simpan terenkripsi di tabel sementara
      const otp = generateOtpCode()
      const [pinHash, otpHash] = await Promise.all([
        bcrypt.hash(String(pin), 10),
        bcrypt.hash(otp, 10),
      ])
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 menit
      const chosenColor =
        avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].value

      await prisma.emailVerification.upsert({
        where: { email: cleanEmail },
        update: {
          username: cleanUsername,
          pinHash,
          familyName: cleanFamilyName,
          avatarColor: chosenColor,
          otpHash,
          attempts: 0,
          expiresAt,
        },
        create: {
          email: cleanEmail,
          username: cleanUsername,
          pinHash,
          familyName: cleanFamilyName,
          avatarColor: chosenColor,
          otpHash,
          attempts: 0,
          expiresAt,
        },
      })

      // 5. Kirim OTP ke email pengguna
      const mailResult = await sendVerificationOtpEmail({
        email: cleanEmail,
        username: cleanUsername,
        familyName: cleanFamilyName,
        otp,
      })

      return NextResponse.json({
        success: true,
        step: 'verify_otp',
        email: cleanEmail,
        smtpConfigured: mailResult.sent,
        ...(!mailResult.sent && {
          devOtp: otp,
          devOtpPreview: otp,
          devMessage:
            'SMTP belum diatur di .env. Untuk pengujian lokal, gunakan kode OTP berikut:',
        }),
      })
    }

    // =========================================================================
    // TAHAP 2: VERIFIKASI OTP 6 DIGIT & AKTIVASI CASH BOOK BARU (SUPERADMIN)
    // =========================================================================
    if (action === 'verify_otp') {
      const verifyRate = checkRateLimit(`verify-otp-ip:${clientIp}`, 8, 5 * 60 * 1000)
      if (!verifyRate.success) {
        const waitSec = Math.max(1, Math.ceil((verifyRate.resetTime - Date.now()) / 1000))
        return NextResponse.json(
          {
            errorKey: 'rate_limit',
            error: `Terlalu banyak percobaan verifikasi. Tunggu ${waitSec} detik.`,
          },
          { status: 429 }
        )
      }

      const { email } = body
      const otp = body.otp || body.otpCode
      if (!email || !otp) {
        return NextResponse.json(
          { errorKey: 'required_field', error: 'Email dan kode OTP 6 digit wajib diisi.' },
          { status: 400 }
        )
      }

      const cleanEmail = email.trim().toLowerCase()
      const cleanOtp = String(otp).trim()

      const record = await prisma.emailVerification.findUnique({
        where: { email: cleanEmail },
      })

      if (!record) {
        return NextResponse.json(
          {
            errorKey: 'otp_not_found',
            error: 'Sesi verifikasi tidak ditemukan atau sudah kadaluarsa. Silakan minta kode baru.',
          },
          { status: 404 }
        )
      }

      if (new Date() > new Date(record.expiresAt)) {
        await prisma.emailVerification.delete({ where: { email: cleanEmail } }).catch(() => {})
        return NextResponse.json(
          {
            errorKey: 'otp_expired',
            error: 'Kode OTP sudah kadaluarsa (lebih dari 10 menit). Silakan kirim ulang kode.',
          },
          { status: 400 }
        )
      }

      if (record.attempts >= 5) {
        await prisma.emailVerification.delete({ where: { email: cleanEmail } }).catch(() => {})
        return NextResponse.json(
          {
            errorKey: 'otp_max_attempts',
            error: 'Batas maksimal 5 percobaan salah terlampaui. Kode OTP hangus demi keamanan.',
          },
          { status: 403 }
        )
      }

      const isOtpValid = await bcrypt.compare(cleanOtp, record.otpHash)
      if (!isOtpValid) {
        const nextAttempts = record.attempts + 1
        if (nextAttempts >= 5) {
          await prisma.emailVerification.delete({ where: { email: cleanEmail } }).catch(() => {})
          return NextResponse.json(
            {
              errorKey: 'otp_max_attempts',
              error: 'Kode OTP salah 5 kali. Kode telah hangus, silakan minta kode baru.',
            },
            { status: 403 }
          )
        }

        await prisma.emailVerification.update({
          where: { email: cleanEmail },
          data: { attempts: nextAttempts },
        })

        return NextResponse.json(
          {
            errorKey: 'otp_invalid',
            error: `Kode OTP salah. Sisa percobaan: ${5 - nextAttempts} kali.`,
            remainingAttempts: 5 - nextAttempts,
          },
          { status: 401 }
        )
      }

      // Pastikan nama Superadmin tetap unik saat aktivasi
      let finalUsername = record.username
      const existingUsername = await prisma.member.findFirst({
        where: { name: finalUsername },
      })
      if (existingUsername) {
        const suggestions = await generateUsernameSuggestions(finalUsername)
        finalUsername = suggestions[0] || `${finalUsername}_${Math.floor(100 + Math.random() * 900)}`
      }

      // Buat ID Keluarga baru & Kode Undangan unik
      const newFamilyId = crypto.randomUUID()
      let inviteCode = generateInviteCode()
      // Pastikan inviteCode benar-benar unik
      for (let i = 0; i < 5; i++) {
        const dup = await prisma.appSettings.findFirst({ where: { inviteCode } })
        if (!dup) break
        inviteCode = generateInviteCode()
      }

      // Buat ruang Cash Book baru (AppSettings) & akun Superadmin dalam 1 transaksi
      const [, newSuperadmin] = await prisma.$transaction([
        prisma.appSettings.create({
          data: {
            id: newFamilyId,
            familyName: record.familyName,
            inviteCode,
            theme: 'light',
          },
        }),
        prisma.member.create({
          data: {
            familyId: newFamilyId,
            name: finalUsername,
            email: record.email,
            emailVerified: true,
            role: 'superadmin',
            pin: record.pinHash,
            avatarColor: record.avatarColor || '#0d9488',
            isActive: true,
          },
        }),
        prisma.emailVerification.delete({
          where: { email: cleanEmail },
        }),
      ])

      // Catat di Activity Log keluarga baru
      await logActivity({
        familyId: newFamilyId,
        action: 'FAMILY_CREATE',
        description: `${newSuperadmin.name} membuat Cash Book keluarga baru "${record.familyName}" sebagai Super Admin`,
        details: { familyId: newFamilyId, familyName: record.familyName, inviteCode },
        memberId: newSuperadmin.id,
      })

      // Buat JWT token dan langsung login ke dashboard keluarga baru mereka
      const token = await signToken({
        id: newSuperadmin.id,
        name: newSuperadmin.name,
        role: newSuperadmin.role,
        avatarColor: newSuperadmin.avatarColor,
        familyId: newFamilyId,
      })

      const cookieOptions = createSessionCookie(token)
      const response = NextResponse.json(
        {
          success: true,
          familyName: record.familyName,
          inviteCode,
          user: {
            id: newSuperadmin.id,
            name: newSuperadmin.name,
            email: newSuperadmin.email,
            role: newSuperadmin.role,
            avatarColor: newSuperadmin.avatarColor,
            familyId: newFamilyId,
          },
        },
        { status: 201 }
      )

      response.cookies.set(cookieOptions)
      return response
    }

    return NextResponse.json({ error: 'Action tidak dikenali' }, { status: 400 })
  } catch (error) {
    console.error('Register family error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server: ' + (error.message || String(error)) },
      { status: 500 }
    )
  }
}
