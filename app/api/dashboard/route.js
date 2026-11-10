// app/api/dashboard/route.js - Dashboard Summary Data (Optimized Single-Batch Parallel Queries)

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const month = parseInt(searchParams.get('month')) || now.getMonth() + 1
    const year = parseInt(searchParams.get('year')) || now.getFullYear()
    const summaryOnly = searchParams.get('summaryOnly') === 'true'

    // Tanggal awal dan akhir bulan aktif (UTC bounds)
    const firstDay = new Date(Date.UTC(year, month - 1, 1))
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    if (summaryOnly) {
      const [budget, transactions] = await Promise.all([
        prisma.monthlyBudget.findUnique({
          where: { uq_month_year: { familyId, month, year } },
        }),
        prisma.transaction.aggregate({
          where: {
            familyId,
            transactionDate: { gte: firstDay, lte: lastDay },
            category: { not: 'pemasukan' },
          },
          _sum: { amount: true },
        }),
      ])

      const totalBudget = budget ? Number(budget.amount) : 0
      const totalExpense = Number(transactions._sum.amount || 0)
      const remaining = totalBudget - totalExpense

      return NextResponse.json({
        summary: {
          totalBudget,
          totalExpense,
          remaining,
          budgetPercentUsed: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0,
        },
      })
    }

    // Siapkan rentang 6 bulan terakhir (bulan ke-5 sebelum sekarang s/d bulan aktif)
    const monthsToQuery = []
    for (let i = 5; i >= 0; i--) {
      let m = month - i
      let y = year
      if (m <= 0) {
        m += 12
        y -= 1
      }
      monthsToQuery.push({ m, y })
    }

    const oldestMonth = monthsToQuery[0]
    const sixMonthStart = new Date(Date.UTC(oldestMonth.y, oldestMonth.m - 1, 1))
    const sixMonthYears = [...new Set(monthsToQuery.map(item => item.y))]

    // Jalankan SELURUH query database dalam 1 kali Promise.all (1 network round-trip ke TiDB Cloud!)
    const [
      transactions,
      recentTransactions,
      settings,
      sixMonthTxLight,
      sixMonthSnapshots,
      sixMonthBudgets,
    ] = await Promise.all([
      // 1. Semua transaksi bulan aktif (beserta info member)
      prisma.transaction.findMany({
        where: {
          familyId,
          transactionDate: { gte: firstDay, lte: lastDay },
        },
        include: { member: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { transactionDate: 'asc' },
      }),

      // 2. 10 transaksi terbaru
      prisma.transaction.findMany({
        where: { familyId },
        take: 10,
        include: { member: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. App settings keluarga
      prisma.appSettings.findUnique({ where: { id: familyId } }),

      // 4. Transaksi pengeluaran 6 bulan terakhir (hanya kolom ringan untuk tren chart)
      prisma.transaction.findMany({
        where: {
          familyId,
          transactionDate: { gte: sixMonthStart, lte: lastDay },
          category: { not: 'pemasukan' },
        },
        select: {
          amount: true,
          transactionDate: true,
        },
      }),

      // 5. Snapshot arsip 6 bulan terakhir
      prisma.monthlySnapshot.findMany({
        where: {
          familyId,
          year: { in: sixMonthYears },
          category: { not: 'pemasukan' },
        },
        select: {
          month: true,
          year: true,
          totalAmount: true,
        },
      }),

      // 6. Kas bulanan 6 bulan terakhir
      prisma.monthlyBudget.findMany({
        where: {
          familyId,
          year: { in: sixMonthYears },
        },
        select: {
          month: true,
          year: true,
          amount: true,
        },
      }),
    ])

    // Lookup kas bulan aktif dari hasil sixMonthBudgets
    const currentBudgetObj = sixMonthBudgets.find(b => b.month === month && b.year === year)
    const totalBudget = currentBudgetObj ? Number(currentBudgetObj.amount) : 0

    // Hitung total pengeluaran bulan ini
    const totalExpense = transactions
      .filter(t => t.category !== 'pemasukan')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const remaining = totalBudget - totalExpense

    // Rata-rata per hari (berdasarkan hari yang sudah berlalu)
    const today = new Date()
    const daysElapsed = Math.max(
      1,
      today.getMonth() + 1 === month && today.getFullYear() === year
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
      if (t.category !== 'pemasukan') {
        const day = new Date(t.transactionDate).getDate()
        expenseByDay[day] = (expenseByDay[day] || 0) + Number(t.amount)
      }
    })

    const dailyExpenses = Object.entries(expenseByDay).map(([day, amount]) => ({
      day: parseInt(day),
      amount,
    }))

    // Pengeluaran per kategori (untuk pie/donut chart)
    const categoryMap = {}
    transactions.forEach(t => {
      if (t.category !== 'pemasukan') {
        const cat = t.category
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount)
      }
    })
    const expenseByCategory = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Akumulasi 6 bulan di memori (tanpa query berulang ke DB)
    const txSumByMonthKey = {}
    for (const tx of sixMonthTxLight) {
      const d = new Date(tx.transactionDate)
      const k = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
      txSumByMonthKey[k] = (txSumByMonthKey[k] || 0) + Number(tx.amount)
    }

    const snapSumByMonthKey = {}
    for (const snap of sixMonthSnapshots) {
      const k = `${snap.year}-${snap.month}`
      snapSumByMonthKey[k] = (snapSumByMonthKey[k] || 0) + Number(snap.totalAmount)
    }

    const budgetByMonthKey = {}
    for (const b of sixMonthBudgets) {
      budgetByMonthKey[`${b.year}-${b.month}`] = Number(b.amount)
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)

    const monthlyTrends = monthsToQuery.map(({ m, y }) => {
      const mLastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
      const key = `${y}-${m}`
      let expenseAmount = 0

      if (mLastDay < cutoffDate) {
        expenseAmount = snapSumByMonthKey[key] || txSumByMonthKey[key] || 0
      } else {
        expenseAmount = txSumByMonthKey[key] || 0
      }

      return {
        month: m,
        year: y,
        expense: expenseAmount,
        budget: budgetByMonthKey[key] || 0,
      }
    })

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
