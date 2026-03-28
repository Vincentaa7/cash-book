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

    const { month, year, amount } = await request.json()

    if (!month || !year || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Data kas tidak valid' }, { status: 400 })
    }

    // Upsert: update jika ada, create jika belum
    const budget = await prisma.monthlyBudget.upsert({
      where: { uq_month_year: { month: parseInt(month), year: parseInt(year) } },
      update: {
        amount: BigInt(amount),
        createdBy: session.id,
      },
      create: {
        month: parseInt(month),
        year: parseInt(year),
        amount: BigInt(amount),
        createdBy: session.id,
      },
    })

    return NextResponse.json({
      budget: { ...budget, amount: Number(budget.amount) },
    })
  } catch (error) {
    console.error('Set budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
