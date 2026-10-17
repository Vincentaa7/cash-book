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

    // 1. Cek apakah sudah diproses bulan ini
    const settings = await prisma.appSettings.findUnique({ where: { id: familyId } })
    if (settings?.lastCarryOverMonth === currentMonthStr) {
      return NextResponse.json({ hasCarryover: false })
    }

    // 1b. Jika kas bulan ini SUDAH diatur (manual), jangan tampilkan popup:
    //     "Setuju" akan menggandakan saldo, "Tolak" dulu menghapus kas bulan ini.
    const currentBudget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { familyId, month: currentMonth, year: currentYear } },
    })
    if (currentBudget) {
      await prisma.appSettings.update({
        where: { id: familyId },
        data: { lastCarryOverMonth: currentMonthStr },
      })
      return NextResponse.json({ hasCarryover: false })
    }

    // 2. Hitung Sisa Saldo Bulan Lalu
    let prevMonth = currentMonth - 1
    let prevYear = currentYear
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }

    const firstDayPrev = new Date(Date.UTC(prevYear, prevMonth - 1, 1))
    const lastDayPrev = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999))

    const [budgetPrev, expensePrev] = await Promise.all([
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId, month: prevMonth, year: prevYear } },
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
