// app/api/cleanup/route.js
// Endpoint untuk mengarsipkan & menghapus transaksi satuan yang sudah > 90 hari
// Hanya bisa diakses oleh admin

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

const RETENTION_DAYS = 90

function getCutoffDate() {
  const d = new Date()
  d.setDate(d.getDate() - RETENTION_DAYS)
  d.setHours(0, 0, 0, 0)
  return d
}

// GET /api/cleanup?preview=true
// Menampilkan informasi transaksi yang akan diarsipkan, tanpa menghapus
export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengakses' }, { status: 403 })
    }

    const cutoff = getCutoffDate()

    // Hitung total semua transaksi di database
    const totalAllTx = await prisma.transaction.count()

    // Ambil transaksi yang sudah lebih dari 90 hari
    const oldTransactions = await prisma.transaction.findMany({
      where: { transactionDate: { lt: cutoff } },
      select: {
        id: true,
        amount: true,
        category: true,
        transactionDate: true,
      },
      orderBy: { transactionDate: 'asc' },
    })

    if (oldTransactions.length === 0) {
      return NextResponse.json({
        eligible: 0,
        totalInDb: totalAllTx,
        cutoffDate: cutoff.toISOString().split('T')[0],
        monthsAffected: [],
        message: `Tidak ada transaksi yang lebih dari ${RETENTION_DAYS} hari.`,
      })
    }

    // Group by month+year untuk preview
    const monthMap = {}
    oldTransactions.forEach(tx => {
      const d = new Date(tx.transactionDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[key]) {
        monthMap[key] = { month: d.getMonth() + 1, year: d.getFullYear(), count: 0, total: 0 }
      }
      monthMap[key].count += 1
      monthMap[key].total += Number(tx.amount)
    })

    const monthsAffected = Object.values(monthMap).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    )

    return NextResponse.json({
      eligible: oldTransactions.length,
      totalInDb: totalAllTx,
      cutoffDate: cutoff.toISOString().split('T')[0],
      retentionDays: RETENTION_DAYS,
      monthsAffected,
    })
  } catch (error) {
    console.error('Cleanup preview error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// POST /api/cleanup
// Mengarsipkan ke monthly_snapshots lalu menghapus transaksi satuan > 90 hari
export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengakses' }, { status: 403 })
    }

    const cutoff = getCutoffDate()

    // 1. Ambil semua transaksi yang akan diarsipkan
    const oldTransactions = await prisma.transaction.findMany({
      where: { transactionDate: { lt: cutoff } },
      select: {
        id: true,
        amount: true,
        category: true,
        transactionDate: true,
      },
    })

    if (oldTransactions.length === 0) {
      return NextResponse.json({
        archived: 0,
        deleted: 0,
        monthsAffected: 0,
        message: `Tidak ada transaksi yang lebih dari ${RETENTION_DAYS} hari.`,
      })
    }

    // 2. Agregasi per (month, year, category)
    const snapshotMap = {}
    oldTransactions.forEach(tx => {
      const d = new Date(tx.transactionDate)
      const month = d.getMonth() + 1
      const year = d.getFullYear()
      const key = `${year}-${month}-${tx.category}`

      if (!snapshotMap[key]) {
        snapshotMap[key] = { month, year, category: tx.category, totalAmount: BigInt(0), txCount: 0 }
      }
      snapshotMap[key].totalAmount += BigInt(tx.amount)
      snapshotMap[key].txCount += 1
    })

    const snapshots = Object.values(snapshotMap)

    // 3. Upsert ke monthly_snapshots (tambahkan jika sudah ada)
    await Promise.all(
      snapshots.map(snap =>
        prisma.monthlySnapshot.upsert({
          where: {
            uq_snapshot: {
              month: snap.month,
              year: snap.year,
              category: snap.category,
            },
          },
          update: {
            // Tambahkan ke yang sudah ada (jika cleanup dijalankan berkali-kali)
            totalAmount: { increment: snap.totalAmount },
            txCount: { increment: snap.txCount },
          },
          create: {
            month: snap.month,
            year: snap.year,
            category: snap.category,
            totalAmount: snap.totalAmount,
            txCount: snap.txCount,
          },
        })
      )
    )

    // 4. Hapus transaksi satuan yang sudah diarsipkan
    const idsToDelete = oldTransactions.map(tx => tx.id)
    const deleteResult = await prisma.transaction.deleteMany({
      where: { id: { in: idsToDelete } },
    })

    // Hitung bulan unik yang terdampak
    const uniqueMonths = new Set(snapshots.map(s => `${s.year}-${s.month}`))

    return NextResponse.json({
      archived: oldTransactions.length,
      deleted: deleteResult.count,
      monthsAffected: uniqueMonths.size,
      snapshotsCreatedOrUpdated: snapshots.length,
      message: `Berhasil mengarsipkan ${oldTransactions.length} transaksi dari ${uniqueMonths.size} bulan.`,
    })
  } catch (error) {
    console.error('Cleanup execute error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + error.message }, { status: 500 })
  }
}
