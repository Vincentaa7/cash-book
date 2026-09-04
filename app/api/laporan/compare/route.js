// app/api/laporan/compare/route.js - Get Monthly Expense Comparison (6 months)
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

async function getMonthExpense(month, year, cutoffDate) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  let expenseAmount = 0
  if (lastDay < cutoffDate) {
    // Ambil dari monthly_snapshots
    const snapshotAgg = await prisma.monthlySnapshot.aggregate({
      where: { month, year, category: { not: 'pemasukan' } },
      _sum: { totalAmount: true },
    })
    expenseAmount = Number(snapshotAgg._sum.totalAmount || 0)

    // Jika snapshot kosong, coba fallback ke transactions
    if (expenseAmount === 0) {
      const txAgg = await prisma.transaction.aggregate({
        where: {
          transactionDate: { gte: firstDay, lte: lastDay },
          category: { not: 'pemasukan' }
        },
        _sum: { amount: true },
      })
      expenseAmount = Number(txAgg._sum.amount || 0)
    }
  } else {
    // Bulan masih dalam range 90 hari, ambil dari transactions
    const txAgg = await prisma.transaction.aggregate({
      where: {
        transactionDate: { gte: firstDay, lte: lastDay },
        category: { not: 'pemasukan' }
      },
      _sum: { amount: true },
    })
    expenseAmount = Number(txAgg._sum.amount || 0)
  }
  return expenseAmount
}

// Helper: offset month by N steps
function offsetMonth(month, year, offsetMonths) {
  let m = month + offsetMonths
  let y = year
  while (m <= 0) { m += 12; y -= 1 }
  while (m > 12) { m -= 12; y += 1 }
  return { month: m, year: y }
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

    // Cutoff date untuk arsip (90 hari)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)

    // Ambil 6 bulan: current + 5 bulan sebelumnya
    const months6 = []
    for (let i = -5; i <= 0; i++) {
      const { month: m, year: y } = offsetMonth(month, year, i)
      const amount = await getMonthExpense(m, y, cutoffDate)
      months6.push({ month: m, year: y, amount })
    }

    // Current & previous
    const current = months6[5]  // index 5 = bulan target
    const previous = months6[4] // index 4 = bulan lalu

    // Rata-rata 3 bulan terakhir (3 bulan sebelum current)
    const avg3Months = Math.round(
      (months6[3].amount + months6[4].amount + months6[5].amount) / 3
    )

    // Persentase perubahan: current vs previous
    let changePercent = 0
    let changeTrend = 'same' // 'up' | 'down' | 'same'
    if (previous.amount > 0) {
      changePercent = Math.round(((current.amount - previous.amount) / previous.amount) * 100)
      changeTrend = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'same'
    }

    return NextResponse.json({
      current,
      previous,
      avg3Months,
      changePercent,
      changeTrend,
      history: months6, // Array 6 bulan untuk bar chart
    })
  } catch (error) {
    console.error('Get comparison error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
