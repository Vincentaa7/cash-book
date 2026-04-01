// app/api/budget/check-carryover/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

    // 1. Cek apakah sudah diproses bulan ini
    const settings = await prisma.appSettings.findFirst({ where: { id: '1' } })
    if (settings?.lastCarryOverMonth === currentMonthStr) {
      return NextResponse.json({ hasCarryover: false })
    }

    // 2. Hitung Sisa Saldo Bulan Lalu
    let prevMonth = currentMonth - 1
    let prevYear = currentYear
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }

    const firstDayPrev = new Date(prevYear, prevMonth - 1, 1)
    const lastDayPrev = new Date(prevYear, prevMonth, 0)

    const [budgetPrev, expensePrev] = await Promise.all([
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { month: prevMonth, year: prevYear } },
      }),
      prisma.transaction.aggregate({
        where: { transactionDate: { gte: firstDayPrev, lte: lastDayPrev } },
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
