// app/api/budget/transfer/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, action } = await request.json()
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

    if (action === 'reject') {
      // 'Fresh Start': Hapus record kas bulan ini (jika ada) agar admin harus mengeset ulang
      await Promise.all([
        prisma.monthlyBudget.deleteMany({
          where: { month, year }
        }),
        prisma.appSettings.update({
          where: { id: '1' },
          data: { lastCarryOverMonth: currentMonthStr },
        })
      ])
      return NextResponse.json({ success: true, message: 'Rejected/Fresh-Start' })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // 1. Update/Upsert Budget Bulan Ini
    const budget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { month, year } },
    })

    const newAmount = (budget ? Number(budget.amount) : 0) + Number(amount)

    await prisma.monthlyBudget.upsert({
      where: { uq_month_year: { month, year } },
      update: { amount: BigInt(newAmount) },
      create: { 
        month, 
        year, 
        amount: BigInt(newAmount), 
        createdBy: session.id 
      },
    })

    // 2. Tandai sudah diproses bulan ini
    await prisma.appSettings.update({
      where: { id: '1' },
      data: { lastCarryOverMonth: currentMonthStr },
    })

    return NextResponse.json({ success: true, newAmount })
  } catch (error) {
    console.error('Transfer carryover error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
