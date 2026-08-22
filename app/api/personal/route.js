// app/api/personal/route.js - Buku Kas Pribadi API (GET list + POST create)

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
    const page     = parseInt(searchParams.get('page'))  || 1
    const limit    = parseInt(searchParams.get('limit')) || 20
    const type     = searchParams.get('type')     || ''
    const category = searchParams.get('category') || ''
    const month    = searchParams.get('month') ? parseInt(searchParams.get('month')) : null
    const year     = searchParams.get('year')  ? parseInt(searchParams.get('year'))  : null
    const start    = searchParams.get('startDate')|| ''
    const end      = searchParams.get('endDate')  || ''

    // Tentukan range tanggal
    let dateFilter = {}
    if (month && year) {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay  = new Date(year, month, 0, 23, 59, 59, 999)
      dateFilter = { gte: firstDay, lte: lastDay }
    } else if (start || end) {
      dateFilter = {
        ...(start && { gte: new Date(start) }),
        ...(end   && { lte: new Date(end + 'T23:59:59') }),
      }
    }

    const where = {
      memberId: session.id, // Hanya milik sendiri!
      ...(type     && { type }),
      ...(category && { category }),
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    }

    const [items, total] = await Promise.all([
      prisma.personalTransaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.personalTransaction.count({ where }),
    ])

    // Ambil saldo utama untuk periode bulan & tahun ini
    const curMonth = month || (new Date().getMonth() + 1)
    const curYear  = year  || new Date().getFullYear()

    let budgetAmount = 0
    if (prisma.personalBudget) {
      const personalBudget = await prisma.personalBudget.findUnique({
        where: {
          uq_personal_budget: {
            memberId: session.id,
            month: curMonth,
            year:  curYear,
          },
        },
      })
      if (personalBudget) budgetAmount = Number(personalBudget.amount)
    } else {
      const rows = await prisma.$queryRaw`
        SELECT amount FROM personal_budgets
        WHERE member_id = ${session.id} AND month = ${curMonth} AND year = ${curYear}
        LIMIT 1
      `
      if (rows.length > 0) budgetAmount = Number(rows[0].amount)
    }

    // Hitung summary untuk bulan & tahun yang dipilih
    const periodWhere = {
      memberId: session.id,
      date: {
        gte: new Date(curYear, curMonth - 1, 1),
        lte: new Date(curYear, curMonth, 0, 23, 59, 59, 999),
      },
    }

    const periodItems = await prisma.personalTransaction.findMany({
      where: periodWhere,
      select: { amount: true, type: true, itemName: true },
    })

    const totalExpense = periodItems
      .filter(i => i.type === 'expense')
      .reduce((s, i) => s + Number(i.amount), 0)

    const totalIncome = periodItems
      .filter(i => i.type === 'income')
      .reduce((s, i) => s + Number(i.amount), 0)

    // Sisa saldo kalkulasi:
    // Jika ada Saldo Utama: Sisa Saldo = Saldo Utama - Total Pengeluaran
    // Jika tidak ada Saldo Utama: Sisa Saldo = Total Pemasukan - Total Pengeluaran
    let balance = 0
    if (budgetAmount > 0) {
      balance = budgetAmount - totalExpense
    } else {
      balance = totalIncome - totalExpense
    }

    const usagePercent = budgetAmount > 0 ? Math.min(100, Math.round((totalExpense / budgetAmount) * 100)) : 0

    return NextResponse.json({
      items: items.map(i => ({ ...i, amount: Number(i.amount) })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
      summary: {
        budgetAmount,
        totalIncome,
        totalExpense,
        balance,
        usagePercent,
        hasBudget: budgetAmount > 0,
        month: curMonth,
        year: curYear,
      },
    })
  } catch (error) {
    console.error('GET personal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { itemName, amount, type, category, date, notes } = await request.json()

    if (!itemName || !amount || !category || !date) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
    }

    const item = await prisma.personalTransaction.create({
      data: {
        memberId: session.id,
        itemName: itemName.trim(),
        amount:   BigInt(amount),
        type:     type || 'expense',
        category: category,
        date:     new Date(date),
        notes:    notes?.trim() || null,
      },
    })

    return NextResponse.json({ item: { ...item, amount: Number(item.amount) } }, { status: 201 })
  } catch (error) {
    console.error('POST personal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}
