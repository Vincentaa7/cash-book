// app/api/members/[id]/route.js - Edit & Delete Member (Admin Only)

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function PUT(request, { params }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengedit anggota' }, { status: 403 })
    }

    const { id } = await params
    const existingMember = await prisma.member.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, avatarColor: true, isActive: true },
    })

    if (!existingMember) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 })
    }

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

    // Log aktivitas update anggota
    let logDescription = `${session.name} memperbarui informasi anggota "${existingMember.name}"`
    let logAction = 'MEMBER_UPDATE'

    if (isActive !== undefined && isActive !== existingMember.isActive) {
      logAction = 'MEMBER_TOGGLE_ACTIVE'
      logDescription = `${session.name} ${isActive ? 'mengaktifkan' : 'menonaktifkan'} anggota "${existingMember.name}"`
    }

    await logActivity({
      action: logAction,
      description: logDescription,
      details: {
        id,
        old: {
          name: existingMember.name,
          role: existingMember.role,
          avatarColor: existingMember.avatarColor,
          isActive: existingMember.isActive,
        },
        new: {
          name: name !== undefined ? name : existingMember.name,
          role: role !== undefined ? role : existingMember.role,
          avatarColor: avatarColor !== undefined ? avatarColor : existingMember.avatarColor,
          isActive: isActive !== undefined ? isActive : existingMember.isActive,
        },
      },
      memberId: session.id,
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

    const existingMember = await prisma.member.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!existingMember) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 })
    }

    // Jangan hapus admin terakhir
    if (session.id === id) {
      return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 })
    }

    // Soft delete: nonaktifkan saja
    await prisma.member.update({
      where: { id },
      data: { isActive: false },
    })

    // Log aktivitas nonaktifkan anggota
    await logActivity({
      action: 'MEMBER_TOGGLE_ACTIVE',
      description: `${session.name} menonaktifkan anggota "${existingMember.name}"`,
      details: { id, name: existingMember.name, isActive: false },
      memberId: session.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
