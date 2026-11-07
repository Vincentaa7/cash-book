// app/api/budget/check-carryover/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getAppToday } from '@/lib/cashbook'

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { searchParams } = new URL(request.url)
    const paramMonth = parseInt(searchParams.get('month'))
    const paramYear = parseInt(searchParams.get('year'))

    // Prioritaskan waktu lokal pengguna dari browser (tepat 00:00 waktu lokal klien),
    // fallback ke getAppToday() (WITA)
    const today = getAppToday()
    const currentMonth = (paramMonth >= 1 && paramMonth <= 12) ? paramMonth : today.month
    const currentYear = (paramYear >= 2020 && paramYear <= 2100) ? paramYear : today.year
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

    let prevMonth = currentMonth - 1
    let prevYear = currentYear
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }

    const firstDayPrev = new Date(Date.UTC(prevYear, prevMonth - 1, 1))
    const lastDayPrev = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999))

    // Eksekusi semua pengecekan dalam 1 kali Promise.all (1 round-trip ke database!)
    const [settings, currentBudget, budgetPrev, expensePrev] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: familyId }, select: { lastCarryOverMonth: true } }),
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId, month: currentMonth, year: currentYear } },
        select: { id: true },
      }),
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId, month: prevMonth, year: prevYear } },
        select: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          familyId,
          transactionDate: { gte: firstDayPrev, lte: lastDayPrev },
          category: { not: 'pemasukan' },
        },
        _sum: { amount: true },
      }),
    ])

    // 1. Cek apakah sudah diproses bulan ini
    if (settings?.lastCarryOverMonth === currentMonthStr) {
      return NextResponse.json({ hasCarryover: false })
    }

    // 1b. Jika kas bulan ini SUDAH diatur (manual), jangan tampilkan popup
    if (currentBudget) {
      void prisma.appSettings.update({
        where: { id: familyId },
        data: { lastCarryOverMonth: currentMonthStr },
      }).catch(() => {})
      return NextResponse.json({ hasCarryover: false })
    }

    const totalBudgetPrev = budgetPrev ? Number(budgetPrev.amount) : 0
    const totalExpensePrev = Number(expensePrev._sum.amount || 0)
    const remainingPrev = totalBudgetPrev - totalExpensePrev

    if (remainingPrev > 0) {
      return NextResponse.json({
        hasCarryover: true,
        amount: remainingPrev,
        prevMonth,
        prevYear,
      })
    }

    return NextResponse.json({ hasCarryover: false })
  } catch (error) {
    console.error('Check carryover error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
