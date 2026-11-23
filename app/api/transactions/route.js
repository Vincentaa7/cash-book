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

    // Mode cepat: ambil 6 template transaksi pengeluaran paling sering dicatat (1-Tap Quick-Add)
    if (searchParams.get('frequent') === 'true') {
      const recentRows = await prisma.transaction.findMany({
        where: {
          familyId,
          category: { not: 'pemasukan' },
        },
        select: {
          itemName: true,
          category: true,
          amount: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 150,
      })

      const freqMap = new Map()
      for (const row of recentRows) {
        const display = (row.itemName || '').trim()
        if (!display) continue
        const key = display.toLowerCase()
        const existing = freqMap.get(key)
        if (existing) {
          existing.count += 1
        } else {
          // Karena urutan desc, entri pertama adalah nominal & kategori paling baru
          freqMap.set(key, {
            itemName: display,
            category: row.category,
            amount: Number(row.amount),
            count: 1,
          })
        }
      }

      const templates = [...freqMap.values()]
        .filter(item => item.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      return NextResponse.json({ templates })
    }

    const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
    const isAll = searchParams.get('all') === 'true' || searchParams.get('limit') === 'all' || searchParams.get('limit') === '-1'
    const limitParam = searchParams.get('limit')
    const limit = isAll
      ? 10000
      : Math.min(Math.max(1, parseInt(limitParam) || 20), 5000)
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

    let totalExpensePromise
    let totalIncomePromise

    if (category === 'pemasukan') {
      totalExpensePromise = Promise.resolve({ _sum: { amount: 0 } })
      totalIncomePromise = prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      })
    } else if (category) {
      totalExpensePromise = prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      })
      totalIncomePromise = Promise.resolve({ _sum: { amount: 0 } })
    } else {
      totalExpensePromise = prisma.transaction.aggregate({
        where: { ...where, category: { not: 'pemasukan' } },
        _sum: { amount: true },
      })
      totalIncomePromise = prisma.transaction.aggregate({
        where: { ...where, category: 'pemasukan' },
        _sum: { amount: true },
      })
    }

    const [transactions, total, expAgg, incAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: orderClause,
        ...(isAll ? {} : { skip, take: limit }),
      }),
      prisma.transaction.count({ where }),
      totalExpensePromise,
      totalIncomePromise,
    ])

    const totalExpense = Number(expAgg?._sum?.amount || 0)
    const totalIncome = Number(incAgg?._sum?.amount || 0)
    const totalAmount = category === 'pemasukan' ? totalIncome : totalExpense

    return NextResponse.json({
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      total,
      totalExpense,
      totalIncome,
      totalAmount,
      page: isAll ? 1 : page,
      totalPages: isAll ? 1 : Math.ceil(total / limit),
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
    const cleanItemName = typeof itemName === 'string' ? itemName.trim() : ''
    const numericAmount = Number(amount)
    const txDate = new Date(transactionDate)

    if (!cleanItemName || !category || !transactionDate || Number.isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Data transaksi tidak lengkap atau tanggal tidak valid' }, { status: 400 })
    }

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Jumlah harus berupa bilangan bulat lebih dari 0' }, { status: 400 })
    }

    // Eksekusi insert transaksi & sinkronisasi kas bulan secara atomik dalam 1 DB transaction
    const { transaction, adjustedMonths } = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          familyId,
          itemName: cleanItemName,
          amount: BigInt(numericAmount),
          category,
          transactionDate: txDate,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          memberId: session.id,
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
      })

      const adjusted = await syncBudgetsForTransactionChange(null, created, { db: tx })
      return { transaction: created, adjustedMonths: adjusted }
    })

    // WAJIB di-await sebelum return agar tidak terpotong oleh Vercel Serverless freeze
    const txMonth = txDate.getUTCMonth() + 1
    const txYear = txDate.getUTCFullYear()
    const remainingBalance = await getMonthRemainingBalance(txMonth, txYear, familyId)
    const balanceText =
      (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
      (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

    await logActivity({
      action: 'TRANSACTION_CREATE',
      description: `${session.name} mencatat transaksi "${cleanItemName}" sebesar ${formatRupiah(numericAmount)}${balanceText}`,
      details: {
        id: transaction.id,
        itemName: cleanItemName,
        amount: numericAmount,
        category,
        transactionDate,
        notes: transaction.notes,
        remainingBalance,
        adjustedMonths,
      },
      memberId: session.id,
      familyId,
    })

    return NextResponse.json({
      transaction: { ...transaction, amount: Number(transaction.amount) },
    }, { status: 201 })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
