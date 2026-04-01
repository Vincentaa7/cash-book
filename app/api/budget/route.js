// app/api/budget/route.js - Kas Bulanan API

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
    const month = parseInt(searchParams.get('month')) || new Date().getMonth() + 1
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear()
    const history = searchParams.get('history') === 'true'

    if (history) {
      // Ambil 6 bulan terakhir untuk chart tren
      const budgets = await prisma.monthlyBudget.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 6,
        include: { creator: { select: { name: true } } },
      })
      return NextResponse.json({ budgets: budgets.map(b => ({
        ...b,
        amount: Number(b.amount),
      })) })
    }

    const budget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { month, year } },
      include: { creator: { select: { name: true } } },
    })

    return NextResponse.json({
      budget: budget ? { ...budget, amount: Number(budget.amount) } : null,
    })
  } catch (error) {
    console.error('Get budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengatur kas bulanan' }, { status: 403 })
    }

    const { month, year, amount, action = 'set' } = await request.json()
    const parsedMonth = parseInt(month)
    const parsedYear = parseInt(year)
    const parsedAmount = BigInt(amount)

    if (!month || !year || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Data kas tidak valid' }, { status: 400 })
    }

    let budget;
    if (action === 'add') {
      // Periksa apakah budget sudah ada sebelum increment
      const existing = await prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { month: parsedMonth, year: parsedYear } }
      })

      if (!existing) {
        return NextResponse.json({ error: 'Harus mengatur kas utama terlebih dahulu' }, { status: 400 })
      }

      budget = await prisma.monthlyBudget.update({
        where: { uq_month_year: { month: parsedMonth, year: parsedYear } },
        data: {
          amount: { increment: parsedAmount },
          createdBy: session.id,
        },
      })
    } else {
      // Upsert: update jika ada, create jika belum
      budget = await prisma.monthlyBudget.upsert({
        where: { uq_month_year: { month: parsedMonth, year: parsedYear } },
        update: {
          amount: parsedAmount,
          createdBy: session.id,
        },
        create: {
          month: parsedMonth,
          year: parsedYear,
          amount: parsedAmount,
          createdBy: session.id,
        },
      })
    }

    return NextResponse.json({
      budget: { ...budget, amount: Number(budget.amount) },
    })
  } catch (error) {
    console.error('Set budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
