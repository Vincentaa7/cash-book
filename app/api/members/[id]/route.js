// app/api/members/[id]/route.js - Edit & Delete Member (Admin Only)

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function PUT(request, { params }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengedit anggota' }, { status: 403 })
    }

    const { id } = await params
    const { name, pin, role, avatarColor, isActive } = await request.json()

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (avatarColor !== undefined) updateData.avatarColor = avatarColor
    if (isActive !== undefined) updateData.isActive = isActive
    if (pin) {
      updateData.pin = await bcrypt.hash(pin, 10)
    }

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, role: true, avatarColor: true, isActive: true },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menonaktifkan anggota' }, { status: 403 })
    }

    const { id } = await params

    // Jangan hapus admin terakhir
    if (session.id === id) {
      return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 })
    }

    // Soft delete: nonaktifkan saja
    await prisma.member.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
