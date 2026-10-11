// app/api/budget/transfer/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'
import { getAppToday } from '@/lib/cashbook'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, month: bodyMonth, year: bodyYear } = await request.json()
    // Prioritaskan waktu lokal pengguna dari peramban, fallback ke WITA
    const today = getAppToday()
    const month = (bodyMonth >= 1 && bodyMonth <= 12) ? bodyMonth : today.month
    const year = (bodyYear >= 2020 && bodyYear <= 2100) ? bodyYear : today.year
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

    const existingBudget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { month, year } },
    })

    if (action === 'reject') {
      // Tolak pindahan: HANYA tandai sudah diproses.
      // Kas bulan ini yang sudah ada TIDAK lagi dihapus (dulu bisa menghapus
      // kas yang baru saja diatur admin).
      await Promise.all([
        prisma.appSettings.update({
          where: { id: '1' },
          data: { lastCarryOverMonth: currentMonthStr },
        }),
        logActivity({
          action: 'BUDGET_UPDATE',
          description: `${session.name} menolak pemindahan sisa kas bulan lalu ke ${month}/${year}`,
          details: { month, year, action: 'reject', existingBudget: existingBudget ? Number(existingBudget.amount) : null },
          memberId: session.id,
        })
      ])
      return NextResponse.json({ success: true, message: 'Rejected' })
    }

    // Cegah saldo ganda: jika kas bulan ini sudah ada (sudah dipindah / diatur manual)
    if (existingBudget) {
      await prisma.appSettings.update({
        where: { id: '1' },
        data: { lastCarryOverMonth: currentMonthStr },
      })
      return NextResponse.json(
        { error: 'Kas bulan ini sudah diatur. Pindahan saldo dibatalkan agar tidak ganda.' },
        { status: 409 }
      )
    }

    // Hitung ulang sisa saldo bulan lalu di server (tidak percaya nominal dari browser,
    // karena bisa sudah berubah sejak popup muncul)
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth === 0) { prevMonth = 12; prevYear -= 1 }
    const amount = await getMonthRemainingBalance(prevMonth, prevYear)

    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: 'Tidak ada sisa saldo bulan lalu untuk dipindahkan' }, { status: 400 })
    }

    await prisma.monthlyBudget.create({
      data: {
        month,
        year,
        amount: BigInt(amount),
        createdBy: session.id,
      },
    })

    // Tandai sudah diproses bulan ini
    await prisma.appSettings.update({
      where: { id: '1' },
      data: { lastCarryOverMonth: currentMonthStr },
    })

    // Catat log aktivitas pindah saldo
    const remainingBalance = await getMonthRemainingBalance(month, year)
    const balanceText = remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : ''

    await logActivity({
      action: 'BUDGET_UPDATE',
      description: `${session.name} memindahkan sisa kas ${prevMonth}/${prevYear} sebesar ${formatRupiah(amount)} ke kas bulan ${month}/${year}${balanceText}`,
      details: { month, year, prevMonth, prevYear, amount, action: 'agree', totalBudget: amount, remainingBalance },
      memberId: session.id,
    })

    return NextResponse.json({ success: true, newAmount: amount })
  } catch (error) {
    console.error('Transfer carryover error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
