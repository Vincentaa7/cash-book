// app/api/laporan/compare/route.js - Get Monthly Expense Comparison (6 months, Optimized Single-Batch)
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

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

    const familyId = session.familyId || '1'
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const month = parseInt(searchParams.get('month')) || now.getMonth() + 1
    const year = parseInt(searchParams.get('year')) || now.getFullYear()

    // Cutoff date untuk arsip (90 hari)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)

    const monthsList = []
    for (let i = -5; i <= 0; i++) {
      monthsList.push(offsetMonth(month, year, i))
    }

    const oldest = monthsList[0]
    const newest = monthsList[monthsList.length - 1]
    const rangeStart = new Date(Date.UTC(oldest.year, oldest.month - 1, 1))
    const rangeEnd = new Date(Date.UTC(newest.year, newest.month, 0, 23, 59, 59, 999))
    const yearsInRange = [...new Set(monthsList.map(m => m.year))]

    // Eksekusi hanya 2 query paralel sekaligus (menggantikan 6-12 query berurutan sebelumnya)
    const [txList, snapList] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          familyId,
          transactionDate: { gte: rangeStart, lte: rangeEnd },
          category: { not: 'pemasukan' },
        },
        select: {
          amount: true,
          transactionDate: true,
        },
      }),
      prisma.monthlySnapshot.findMany({
        where: {
          familyId,
          year: { in: yearsInRange },
          category: { not: 'pemasukan' },
        },
        select: {
          month: true,
          year: true,
          totalAmount: true,
        },
      }),
    ])

    const txByMonth = {}
    for (const tx of txList) {
      const d = new Date(tx.transactionDate)
      const k = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
      txByMonth[k] = (txByMonth[k] || 0) + Number(tx.amount)
    }

    const snapByMonth = {}
    for (const snap of snapList) {
      const k = `${snap.year}-${snap.month}`
      snapByMonth[k] = (snapByMonth[k] || 0) + Number(snap.totalAmount)
    }

    const months6 = monthsList.map(({ month: m, year: y }) => {
      const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
      const key = `${y}-${m}`
      const amount = lastDay < cutoffDate
        ? (snapByMonth[key] || txByMonth[key] || 0)
        : (txByMonth[key] || 0)
      return { month: m, year: y, amount }
    })

    // Current & previous
    const current = months6[5]  // index 5 = bulan target
    const previous = months6[4] // index 4 = bulan lalu

    // Rata-rata 3 bulan terakhir
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
      months6,
    })
  } catch (error) {
    console.error('Compare error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
