// app/api/laporan/compare/route.js - Get Monthly Expense Comparison
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

async function getMonthExpense(month, year, cutoffDate) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  let expenseAmount = 0
  if (lastDay < cutoffDate) {
    // Ambil dari monthly_snapshots
    const snapshotAgg = await prisma.monthlySnapshot.aggregate({
      where: { month, year },
      _sum: { totalAmount: true },
    })
    expenseAmount = Number(snapshotAgg._sum.totalAmount || 0)

    // Jika snapshot kosong, coba fallback ke transactions (mungkin belum dicleanup)
    if (expenseAmount === 0) {
      const txAgg = await prisma.transaction.aggregate({
        where: { transactionDate: { gte: firstDay, lte: lastDay } },
        _sum: { amount: true },
      })
      expenseAmount = Number(txAgg._sum.amount || 0)
    }
  } else {
    // Bulan masih dalam range 90 hari, ambil dari transactions
    const txAgg = await prisma.transaction.aggregate({
      where: { transactionDate: { gte: firstDay, lte: lastDay } },
      _sum: { amount: true },
    })
    expenseAmount = Number(txAgg._sum.amount || 0)
  }
  return expenseAmount
}

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const month = parseInt(searchParams.get('month')) || now.getMonth() + 1
    const year = parseInt(searchParams.get('year')) || now.getFullYear()

    // Hitung cutoff date untuk arsip (90 hari)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)

    // 1. Bulan target
    const expenseCurrent = await getMonthExpense(month, year, cutoffDate)

    // 2. Bulan lalu
    let prevM = month - 1
    let prevY = year
    if (prevM === 0) {
      prevM = 12
      prevY -= 1
    }
    const expensePrev = await getMonthExpense(prevM, prevY, cutoffDate)

    // 3. Dua bulan lalu
    let prev2M = month - 2
    let prev2Y = year
    if (prev2M <= 0) {
      prev2M += 12
      prev2Y -= 1
    }
    const expensePrev2 = await getMonthExpense(prev2M, prev2Y, cutoffDate)

    // 4. Rata-rata 3 bulan terakhir
    const avg3Months = Math.round((expenseCurrent + expensePrev + expensePrev2) / 3)

    return NextResponse.json({
      current: { month, year, amount: expenseCurrent },
      previous: { month: prevM, year: prevY, amount: expensePrev },
      avg3Months,
    })
  } catch (error) {
    console.error('Get comparison error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
