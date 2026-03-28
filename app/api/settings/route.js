// app/api/settings/route.js - App Settings API

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const settings = await prisma.appSettings.findUnique({ where: { id: '1' } })
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengubah pengaturan' }, { status: 403 })
    }

    const { familyName, theme } = await request.json()

    const settings = await prisma.appSettings.upsert({
      where: { id: '1' },
      update: {
        ...(familyName && { familyName }),
        ...(theme && { theme }),
      },
      create: {
        id: '1',
        familyName: familyName || 'Cash Book',
        theme: theme || 'light',
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
