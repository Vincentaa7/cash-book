// lib/email.js - Utilitas Verifikasi Email OTP, Anti-Disposable Email, Invite Code & Saran Username

import nodemailer from 'nodemailer'
import crypto from 'crypto'
import prisma from './db'

// Daftar domain email sementara / fiktif (Disposable / Temp Mail) yang diblokir demi mencegah spam & DDoS
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', '10minutemail.com', '10minutemail.net',
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'sharklasers.com',
  'grr.la', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me',
  'trashmail.com', 'trashmail.net', 'getnada.com', 'fakeinbox.com',
  'throwawaymail.com', 'maildrop.cc', 'dispostable.com', 'mailnesia.com',
  'mohmal.com', 'tempail.com', 'emailondeck.com', 'mintemail.com',
  'mytemp.email', 'burnermail.io', 'inboxkitten.com', 'mailcatch.com',
  'fakemail.net', 'crazymailing.com', 'tempmailo.com', 'generator.email',
])

/**
 * Validasi format email dan pastikan bukan domain email fiktif/sementara
 */
export function validateActiveEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'invalid_format' }
  }
  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: 'invalid_format' }
  }

  const domain = trimmed.split('@')[1]
  if (!domain || DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, reason: 'disposable_email' }
  }

  return { valid: true, email: trimmed }
}

/**
 * Generate Kode Khusus Keluarga (Invite Code) yang aman secara kriptografi
 * Format: CB-XXXX-XXXX (tanpa karakter membingungkan seperti 0/O, 1/I)
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let part1 = ''
  let part2 = ''
  for (let i = 0; i < 4; i++) part1 += chars[bytes[i] % chars.length]
  for (let i = 4; i < 8; i++) part2 += chars[bytes[i] % chars.length]
  return `CB-${part1}-${part2}`
}

/**
 * Generate kode OTP 6 digit numerik
 */
export function generateOtpCode() {
  const num = crypto.randomInt(100000, 999999)
  return String(num)
}

/**
 * Buat 3 saran username unik yang belum terpakai di database
 */
export async function generateUsernameSuggestions(baseName) {
  const cleanBase = baseName.trim().replace(/\s+/g, '').toLowerCase() || 'user'
  const candidates = [
    `${cleanBase}1`,
    `${cleanBase}${Math.floor(10 + Math.random() * 89)}`,
    `${cleanBase}_${Math.floor(10 + Math.random() * 89)}`,
    `${cleanBase}${new Date().getFullYear().toString().slice(-2)}`,
    `${cleanBase}${Math.floor(100 + Math.random() * 899)}`,
  ]

  const existing = await prisma.member.findMany({
    where: { name: { in: candidates } },
    select: { name: true },
  })
  const existingSet = new Set(existing.map(m => m.name.toLowerCase()))

  const available = []
  for (const c of candidates) {
    if (!existingSet.has(c.toLowerCase()) && !available.includes(c)) {
      available.push(c)
    }
    if (available.length >= 3) break
  }

  while (available.length < 3) {
    available.push(`${cleanBase}${crypto.randomInt(100, 999)}`)
  }

  return available
}

/**
 * Kirim email OTP 6 digit untuk verifikasi pembuatan Cash Book baru (Superadmin)
 */
export async function sendVerificationOtpEmail({ email, username, familyName, otp }) {
  const smtpUser = (process.env.SMTP_USER || '').trim()
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '')
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10)

  if (!smtpUser || !smtpPass || smtpUser === 'your_email@gmail.com') {
    console.warn(`[EMAIL OTP DEV] SMTP belum dikonfigurasi di .env. Kode OTP untuk ${email}: ${otp}`)
    return { sent: false, reason: 'smtp_not_configured' }
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0b0f19; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
      <div style="background: linear-gradient(135deg, #0d9488 0%, #115e59 100%); padding: 24px; text-align: center;">
        <div style="font-size: 28px; margin-bottom: 6px;">💰</div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">Verifikasi Akun Cash Book</h1>
        <p style="margin: 4px 0 0; font-size: 13px; color: #ccfbf1;">Buku Keuangan Keluarga: <strong>${familyName}</strong></p>
      </div>
      <div style="padding: 28px 24px;">
        <p style="margin: 0 0 14px; font-size: 14px; color: #cbd5e1;">Halo <strong>${username}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
          Masukkan 6 digit kode verifikasi berikut pada halaman pendaftaran untuk mengaktifkan ruang Cash Book keluarga Anda:
        </p>
        <div style="background: #111827; border: 2px dashed #14b8a6; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 20px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2dd4bf; font-family: monospace;">${otp}</span>
        </div>
        <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
          ⏳ Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
        </p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Cash Book Digital" <${smtpUser}>`,
    to: email,
    subject: `[${otp}] Kode Verifikasi Cash Book - ${familyName}`,
    html,
  })

  return { sent: true }
}
