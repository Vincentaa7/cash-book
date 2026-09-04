// app/api/budget/transfer/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
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
        }),
        logActivity({
          action: 'BUDGET_UPDATE',
          description: `${session.name} menolak pemindahan sisa kas bulan lalu (Mulai dari Nol untuk ${month}/${year})`,
          details: { month, year, action: 'reject' },
          memberId: session.id,
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

    // 3. Catat log aktivitas pindah saldo
    const remainingBalance = await getMonthRemainingBalance(month, year)
    const balanceText = remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : ''

    await logActivity({
      action: 'BUDGET_UPDATE',
      description: `${session.name} memindahkan sisa kas bulan lalu sebesar ${formatRupiah(amount)} ke kas bulan ${month}/${year}${balanceText}`,
      details: { month, year, amount, action: 'agree', totalBudget: newAmount, remainingBalance },
      memberId: session.id,
    })

    return NextResponse.json({ success: true, newAmount })
  } catch (error) {
    console.error('Transfer carryover error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
