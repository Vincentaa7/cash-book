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

    const familyId = session.familyId || '1'
    const { action, month: bodyMonth, year: bodyYear } = await request.json()
    // Prioritaskan waktu lokal pengguna dari peramban, fallback ke WITA
    const today = getAppToday()
    const month = (bodyMonth >= 1 && bodyMonth <= 12) ? bodyMonth : today.month
    const year = (bodyYear >= 2020 && bodyYear <= 2100) ? bodyYear : today.year
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth === 0) { prevMonth = 12; prevYear -= 1 }

    // Ambil budget bulan ini & hitung sisa saldo bulan lalu secara paralel
    const [existingBudget, amount] = await Promise.all([
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId, month, year } },
      }),
      action === 'reject'
        ? Promise.resolve(null)
        : getMonthRemainingBalance(prevMonth, prevYear, familyId),
    ])

    if (action === 'reject') {
      await prisma.appSettings.update({
        where: { id: familyId },
        data: { lastCarryOverMonth: currentMonthStr },
      })
      void logActivity({
        action: 'BUDGET_UPDATE',
        description: `${session.name} menolak pemindahan sisa kas bulan lalu ke ${month}/${year}`,
        details: { month, year, action: 'reject', existingBudget: existingBudget ? Number(existingBudget.amount) : null },
        memberId: session.id,
        familyId,
      })
      return NextResponse.json({ success: true, message: 'Rejected' })
    }

    // Cegah saldo ganda: jika kas bulan ini sudah ada (sudah dipindah / diatur manual)
    if (existingBudget) {
      await prisma.appSettings.update({
        where: { id: familyId },
        data: { lastCarryOverMonth: currentMonthStr },
      })
      return NextResponse.json(
        { error: 'Kas bulan ini sudah diatur. Pindahan saldo dibatalkan agar tidak ganda.' },
        { status: 409 }
      )
    }

    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: 'Tidak ada sisa saldo bulan lalu untuk dipindahkan' }, { status: 400 })
    }

    // Buat kas bulan baru & tandai sudah diproses secara paralel (1 round-trip!)
    await Promise.all([
      prisma.monthlyBudget.create({
        data: {
          familyId,
          month,
          year,
          amount: BigInt(amount),
          createdBy: session.id,
        },
      }),
      prisma.appSettings.update({
        where: { id: familyId },
        data: { lastCarryOverMonth: currentMonthStr },
      }),
    ])

    // Catat log aktivitas pindah saldo di background
    void (async () => {
      try {
        const remainingBalance = await getMonthRemainingBalance(month, year, familyId)
        const balanceText = remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : ''

        await logActivity({
          action: 'BUDGET_UPDATE',
          description: `${session.name} memindahkan sisa kas ${prevMonth}/${prevYear} sebesar ${formatRupiah(amount)} ke kas bulan ${month}/${year}${balanceText}`,
          details: { month, year, prevMonth, prevYear, amount, action: 'agree', totalBudget: amount, remainingBalance },
          memberId: session.id,
          familyId,
        })
      } catch (err) {
        console.error('Background carryover log error:', err)
      }
    })()

    return NextResponse.json({ success: true, newAmount: amount })
  } catch (error) {
    console.error('Transfer carryover error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
