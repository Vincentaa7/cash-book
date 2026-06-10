// app/api/dashboard/route.js - Dashboard Summary Data

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

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

    // Tanggal awal dan akhir bulan
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)

    // Jalankan semua query secara paralel
    const [budget, transactions, recentTransactions, settings] = await Promise.all([
      // Kas bulan ini
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { month, year } },
      }),

      // Semua transaksi bulan ini
      prisma.transaction.findMany({
        where: {
          transactionDate: { gte: firstDay, lte: lastDay },
        },
        include: { member: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { transactionDate: 'asc' },
      }),

      // 10 transaksi terbaru
      prisma.transaction.findMany({
        take: 10,
        include: { member: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { createdAt: 'desc' },
      }),

      // App settings
      prisma.appSettings.findUnique({ where: { id: '1' } }),
    ])

    // Hitung total pengeluaran bulan ini
    const totalExpense = transactions.reduce((sum, t) => sum + Number(t.amount), 0)
    const totalBudget = budget ? Number(budget.amount) : 0
    const remaining = totalBudget - totalExpense

    // Rata-rata per hari (berdasarkan hari yang sudah berlalu)
    const today = new Date()
    const daysElapsed = Math.max(1, today.getMonth() + 1 === month && today.getFullYear() === year
      ? today.getDate()
      : lastDay.getDate()
    )
    const avgPerDay = Math.round(totalExpense / daysElapsed)

    // Pengeluaran per hari (untuk bar chart)
    const expenseByDay = {}
    const daysInMonth = lastDay.getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      expenseByDay[d] = 0
    }
    transactions.forEach(t => {
      const day = new Date(t.transactionDate).getDate()
      expenseByDay[day] = (expenseByDay[day] || 0) + Number(t.amount)
    })

    const dailyExpenses = Object.entries(expenseByDay).map(([day, amount]) => ({
      day: parseInt(day),
      amount,
    }))

    // Pengeluaran per kategori (untuk pie/donut chart)
    const categoryMap = {}
    transactions.forEach(t => {
      const cat = t.category
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount)
    })
    const expenseByCategory = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Tren 6 bulan terakhir (fallback ke monthly_snapshots jika data sudah diarsip)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)

    // Siapkan list bulan yang akan di-query secara paralel
    const monthsToQuery = []
    for (let i = 5; i >= 0; i--) {
      let m = month - i
      let y = year
      if (m <= 0) { m += 12; y -= 1 }
      monthsToQuery.push({ m, y })
    }

    // Eksekusi semua query secara paralel menggunakan Promise.all
    const monthlyTrends = await Promise.all(
      monthsToQuery.map(async ({ m, y }) => {
        const mFirstDay = new Date(y, m - 1, 1)
        const mLastDay = new Date(y, m, 0)
        let expenseAmount = 0

        // Cek apakah bulan ini sudah melewati cutoff (data mungkin sudah diarsip)
        if (mLastDay < cutoffDate) {
          // Ambil dari monthly_snapshots
          const snapshotAgg = await prisma.monthlySnapshot.aggregate({
            where: { month: m, year: y },
            _sum: { totalAmount: true },
          })
          expenseAmount = Number(snapshotAgg._sum.totalAmount || 0)

          // Jika snapshot kosong, coba fallback ke transactions (mungkin belum dicleanup)
          if (expenseAmount === 0) {
            const txAgg = await prisma.transaction.aggregate({
              where: { transactionDate: { gte: mFirstDay, lte: mLastDay } },
              _sum: { amount: true },
            })
            expenseAmount = Number(txAgg._sum.amount || 0)
          }
        } else {
          // Bulan masih dalam range 90 hari, ambil dari transactions
          const mExpense = await prisma.transaction.aggregate({
            where: { transactionDate: { gte: mFirstDay, lte: mLastDay } },
            _sum: { amount: true },
          })
          expenseAmount = Number(mExpense._sum.amount || 0)
        }

        const mBudget = await prisma.monthlyBudget.findUnique({
          where: { uq_month_year: { month: m, year: y } },
        })

        return {
          month: m,
          year: y,
          expense: expenseAmount,
          budget: mBudget ? Number(mBudget.amount) : 0,
        }
      })
    )

    return NextResponse.json({
      summary: {
        totalBudget,
        totalExpense,
        remaining,
        avgPerDay,
        budgetPercentUsed: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0,
      },
      dailyExpenses,
      expenseByCategory,
      monthlyTrends,
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      familyName: settings?.familyName || 'Cash Book',
      currentMonth: month,
      currentYear: year,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
