// app/api/members/route.js - List & Create Members (Scoped per Family)

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { generateUsernameSuggestions } from '@/lib/email'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'

    const members = await prisma.member.findMany({
      where: { familyId },
      select: {
        id: true,
        familyId: true,
        name: true,
        email: true,
        role: true,
        avatarColor: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Hanya admin yang bisa menambah anggota' }, { status: 403 })
    }

    const familyId = session.familyId || '1'
    const { name, pin, role, avatarColor } = await request.json()

    if (!name || !pin) {
      return NextResponse.json({ error: 'Nama dan Password wajib diisi' }, { status: 400 })
    }

    const cleanName = name.trim()

    // Cek duplikat username secara global agar tidak bentrok saat login
    const existing = await prisma.member.findFirst({
      where: { name: cleanName },
    })
    if (existing) {
      const suggestions = await generateUsernameSuggestions(cleanName)
      return NextResponse.json(
        {
          errorKey: 'username_taken',
          error: `Username "${cleanName}" sudah digunakan. Silakan pilih username unik seperti: ${suggestions.join(', ')}`,
          suggestions,
        },
        { status: 409 }
      )
    }

    // Cek batas maksimal 5 anggota aktif di dalam keluarga ini
    const count = await prisma.member.count({
      where: { familyId, isActive: true },
    })
    if (count >= 5) {
      return NextResponse.json({ error: 'Maksimal 5 anggota keluarga aktif' }, { status: 400 })
    }

    const hashedPin = await bcrypt.hash(String(pin), 10)
    const member = await prisma.member.create({
      data: {
        familyId,
        name: cleanName,
        pin: hashedPin,
        role: role === 'superadmin' ? 'admin' : (role || 'member'),
        emailVerified: true,
        avatarColor: avatarColor || '#0d9488',
      },
      select: { id: true, familyId: true, name: true, role: true, avatarColor: true, isActive: true },
    })

    // Catat log aktivitas tambah anggota di keluarga ini
    await logActivity({
      familyId,
      action: 'MEMBER_CREATE',
      description: `${session.name} menambah anggota keluarga baru bernama "${cleanName}" dengan role "${member.role}"`,
      details: { id: member.id, name: cleanName, role: member.role },
      memberId: session.id,
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Create member error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
