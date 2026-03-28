// app/api/members/route.js - List & Create Members (Admin Only)

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const members = await prisma.member.findMany({
      select: {
        id: true,
        name: true,
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
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menambah anggota' }, { status: 403 })
    }

    const { name, pin, role, avatarColor } = await request.json()

    if (!name || !pin) {
      return NextResponse.json({ error: 'Nama dan PIN wajib diisi' }, { status: 400 })
    }

    // Cek duplikat nama
    const existing = await prisma.member.findFirst({
      where: { name: name },
    })
    if (existing) {
      return NextResponse.json({ error: 'Nama anggota sudah ada' }, { status: 400 })
    }

    // Cek batas maksimal 5 anggota
    const count = await prisma.member.count({ where: { isActive: true } })
    if (count >= 5) {
      return NextResponse.json({ error: 'Maksimal 5 anggota keluarga' }, { status: 400 })
    }

    const hashedPin = await bcrypt.hash(pin, 10)
    const member = await prisma.member.create({
      data: {
        name,
        pin: hashedPin,
        role: role || 'member',
        avatarColor: avatarColor || '#0d9488',
      },
      select: { id: true, name: true, role: true, avatarColor: true, isActive: true },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Create member error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
