// app/api/transactions/route.js - Transactions List & Create

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'
import { syncBudgetsForTransactionChange } from '@/lib/cashbook'

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit')) || 20), 100)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const memberId = searchParams.get('memberId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const sortBy = searchParams.get('sortBy') || 'transactionDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    // Build where clause scoped by familyId
    const where = { familyId }

    if (search) {
      where.OR = [
        { itemName: { contains: search } },
        { notes: { contains: search } },
      ]
    }
    if (category) where.category = category
    if (memberId) where.memberId = memberId

    if (month && year) {
      // Filter bulan tertentu
      const m = parseInt(month)
      const y = parseInt(year)
      const firstDay = new Date(Date.UTC(y, m - 1, 1))
      const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
      where.transactionDate = { gte: firstDay, lte: lastDay }
    } else if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setUTCHours(23, 59, 59, 999)
        where.transactionDate.lte = end
      }
    }

    const skip = (page - 1) * limit

    // Deterministic sorting: selalu gunakan createdAt dan id sebagai tie-breaker
    // agar transaksi di tanggal yang sama tidak tertukar/terlewat saat pagination
    let orderClause = []
    if (sortBy === 'transactionDate') {
      orderClause = [
        { transactionDate: sortOrder },
        { createdAt: sortOrder },
        { id: 'desc' },
      ]
    } else if (sortBy === 'createdAt') {
      orderClause = [
        { createdAt: sortOrder },
        { id: 'desc' },
      ]
    } else {
      orderClause = [
        { [sortBy]: sortOrder },
        { transactionDate: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ]
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: orderClause,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get transactions error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { itemName, amount, category, transactionDate, notes } = await request.json()

    if (!itemName || !amount || !category || !transactionDate) {
      return NextResponse.json({ error: 'Data transaksi tidak lengkap' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 })
    }

    const numericAmount = Number(amount)
    const txDate = new Date(transactionDate)

    // Jalankan insert transaksi & sinkronisasi kas bulan secara paralel (1 round-trip utama!)
    const [transaction, adjustedMonths] = await Promise.all([
      prisma.transaction.create({
        data: {
          familyId,
          itemName,
          amount: BigInt(numericAmount),
          category,
          transactionDate: txDate,
          notes: notes || null,
          memberId: session.id,
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
      }),
      syncBudgetsForTransactionChange(null, {
        familyId,
        amount: numericAmount,
        category,
        transactionDate: txDate,
      }),
    ])

    // Jalankan kalkulasi sisa saldo & pencatatan audit log secara non-blocking di background
    // agar respons simpan ke pengguna kembali secara instan (Near-Zero-Latency CRUD)
    const txMonth = txDate.getUTCMonth() + 1
    const txYear = txDate.getUTCFullYear()
    void (async () => {
      try {
        const remainingBalance = await getMonthRemainingBalance(txMonth, txYear, familyId)
        const balanceText =
          (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
          (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

        await logActivity({
          action: 'TRANSACTION_CREATE',
          description: `${session.name} mencatat transaksi "${itemName}" sebesar ${formatRupiah(numericAmount)}${balanceText}`,
          details: {
            id: transaction.id,
            itemName,
            amount: numericAmount,
            category,
            transactionDate,
            notes,
            remainingBalance,
            adjustedMonths,
          },
          memberId: session.id,
          familyId,
        })
      } catch (err) {
        console.error('Background logActivity error:', err)
      }
    })()

    return NextResponse.json({
      transaction: { ...transaction, amount: Number(transaction.amount) },
    }, { status: 201 })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
