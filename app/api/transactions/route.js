// app/api/transactions/route.js - Transactions List & Create

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
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const memberId = searchParams.get('memberId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const sortBy = searchParams.get('sortBy') || 'transactionDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    // Build where clause
    const where = {}

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
      const firstDay = new Date(y, m - 1, 1)
      const lastDay = new Date(y, m, 0)
      where.transactionDate = { gte: firstDay, lte: lastDay }
    } else if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }

    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { [sortBy]: sortOrder },
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

    const { itemName, amount, category, transactionDate, notes } = await request.json()

    if (!itemName || !amount || !category || !transactionDate) {
      return NextResponse.json({ error: 'Data transaksi tidak lengkap' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 })
    }

    const transaction = await prisma.transaction.create({
      data: {
        itemName,
        amount: BigInt(amount),
        category,
        transactionDate: new Date(transactionDate),
        notes: notes || null,
        memberId: session.id,
      },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    return NextResponse.json({
      transaction: { ...transaction, amount: Number(transaction.amount) },
    }, { status: 201 })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
