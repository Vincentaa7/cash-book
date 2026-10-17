// app/api/settings/route.js - App Settings & Invite Code API (Multi-Family Aware)

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateInviteCode } from '@/lib/email'
import { logActivity } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    let settings = await prisma.appSettings.findUnique({ where: { id: familyId } })

    // Jika belum ada inviteCode di settings keluarga ini, buatkan otomatis
    if (settings && !settings.inviteCode) {
      const code = generateInviteCode()
      settings = await prisma.appSettings.update({
        where: { id: familyId },
        data: { inviteCode: code },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengubah pengaturan' }, { status: 403 })
    }

    const familyId = session.familyId || '1'
    const body = await request.json()
    const { familyName, theme, action, inviteCodeAction, customInviteCode } = body
    const resolvedAction = inviteCodeAction || action

    // Khusus Superadmin: Generate / Ubah Kode Undangan Keluarga
    if (
      resolvedAction === 'generate' ||
      resolvedAction === 'generate_invite_code' ||
      resolvedAction === 'custom' ||
      resolvedAction === 'set_custom_invite_code'
    ) {
      if (session.role !== 'superadmin') {
        return NextResponse.json(
          { error: 'Hanya Super Admin yang dapat mengelola Kode Khusus Keluarga' },
          { status: 403 }
        )
      }

      let newCode = ''
      if (resolvedAction === 'generate' || resolvedAction === 'generate_invite_code') {
        newCode = generateInviteCode()
        for (let i = 0; i < 5; i++) {
          const dup = await prisma.appSettings.findFirst({
            where: { inviteCode: newCode, id: { not: familyId } },
          })
          if (!dup) break
          newCode = generateInviteCode()
        }
      } else {
        const cleanCustom = (customInviteCode || '').trim().toUpperCase()
        if (cleanCustom.length < 6) {
          return NextResponse.json(
            { error: 'Kode custom minimal 6 karakter demi keamanan.' },
            { status: 400 }
          )
        }
        const dup = await prisma.appSettings.findFirst({
          where: { inviteCode: cleanCustom, id: { not: familyId } },
        })
        if (dup) {
          return NextResponse.json(
            { error: 'Kode ini sudah digunakan oleh keluarga lain. Gunakan kode lain atau Generate Otomatis.' },
            { status: 409 }
          )
        }
        newCode = cleanCustom
      }

      const settings = await prisma.appSettings.update({
        where: { id: familyId },
        data: { inviteCode: newCode },
      })

      await logActivity({
        familyId,
        action: 'INVITE_CODE_UPDATE',
        description: `${session.name} memperbarui Kode Khusus Keluarga menjadi "${newCode}"`,
        details: { inviteCode: newCode, mode: resolvedAction },
        memberId: session.id,
      })

      return NextResponse.json({ settings })
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: familyId },
      update: {
        ...(familyName && { familyName }),
        ...(theme && { theme }),
      },
      create: {
        id: familyId,
        familyName: familyName || 'Cash Book',
        inviteCode: generateInviteCode(),
        theme: theme || 'light',
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
