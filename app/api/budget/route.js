// app/api/budget/route.js - Kas Bulanan API (Atomic + Propagasi Lintas Bulan + Reliable Audit Log)

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'
import { getAppToday, syncBudgetsForTransactionChange, propagateBudgetDelta } from '@/lib/cashbook'

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { searchParams } = new URL(request.url)
    const today = getAppToday()
    const month = parseInt(searchParams.get('month'), 10) || today.month
    const year = parseInt(searchParams.get('year'), 10) || today.year
    const history = searchParams.get('history') === 'true'

    if (history) {
      const budgets = await prisma.monthlyBudget.findMany({
        where: { familyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 6,
        include: { creator: { select: { name: true } } },
      })
      return NextResponse.json({
        budgets: budgets.map(b => ({
          ...b,
          amount: Number(b.amount),
        })),
      })
    }

    const budget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { familyId, month, year } },
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
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengatur kas bulanan' }, { status: 403 })
    }

    const familyId = session.familyId || '1'
    const { month, year, amount, action = 'set' } = await request.json()
    const parsedMonth = parseInt(month, 10)
    const parsedYear = parseInt(year, 10)
    const numericAmount = Number(amount)

    // Validasi ketat SEBELUM konversi BigInt agar tidak crash 500
    if (
      !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 ||
      !Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2100 ||
      !Number.isSafeInteger(numericAmount) || numericAmount <= 0
    ) {
      return NextResponse.json({ error: 'Data kas tidak valid (nominal harus bilangan bulat > 0)' }, { status: 400 })
    }

    const parsedAmount = BigInt(numericAmount)

    if (action === 'add') {
      const today = getAppToday()
      let txDate = today.date
      if (today.month !== parsedMonth || today.year !== parsedYear) {
        txDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))
      }

      // Eksekusi increment budget + buat transaksi Top-up + propagasi bulan berikutnya secara atomik
      const txResult = await prisma.$transaction(async (tx) => {
        const existing = await tx.monthlyBudget.findUnique({
          where: { uq_month_year: { familyId, month: parsedMonth, year: parsedYear } },
        })
        if (!existing) {
          return { error: 'Harus mengatur kas utama terlebih dahulu', status: 400 }
        }

        const updatedBudget = await tx.monthlyBudget.update({
          where: { uq_month_year: { familyId, month: parsedMonth, year: parsedYear } },
          data: {
            amount: { increment: parsedAmount },
            createdBy: session.id,
          },
        })

        const newTx = await tx.transaction.create({
          data: {
            familyId,
            itemName: 'Tambah Kas (Top-up)',
            amount: parsedAmount,
            category: 'pemasukan',
            transactionDate: txDate,
            notes: `Penambahan saldo kas oleh ${session.name}`,
            memberId: session.id,
          },
        })

        const adjustedMonths = await syncBudgetsForTransactionChange(null, newTx, {
          skipBudgetForNew: true,
          db: tx,
        })

        return { budget: updatedBudget, adjustedMonths }
      })

      if (txResult.error) {
        return NextResponse.json({ error: txResult.error }, { status: txResult.status })
      }

      const { budget, adjustedMonths } = txResult

      // WAJIB di-await sebelum return agar audit log 100% tersimpan di Vercel Serverless
      const remainingBalance = await getMonthRemainingBalance(parsedMonth, parsedYear, familyId)
      const balanceText =
        (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
        (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

      await logActivity({
        action: 'BUDGET_UPDATE',
        description: `${session.name} menambah kas bulan ${parsedMonth}/${parsedYear} sebesar ${formatRupiah(numericAmount)}${balanceText}`,
        details: {
          month: parsedMonth,
          year: parsedYear,
          amount: numericAmount,
          action,
          total: Number(budget.amount),
          remainingBalance,
          adjustedMonths,
        },
        memberId: session.id,
        familyId,
      })

      return NextResponse.json({
        budget: { ...budget, amount: Number(budget.amount) },
      })
    } else {
      // Action === 'set': upsert budget & propagasikan selisih jika mengubah kas bulan yang sudah ada
      const { budget, adjustedMonths } = await prisma.$transaction(async (tx) => {
        const existing = await tx.monthlyBudget.findUnique({
          where: { uq_month_year: { familyId, month: parsedMonth, year: parsedYear } },
        })

        const upserted = await tx.monthlyBudget.upsert({
          where: { uq_month_year: { familyId, month: parsedMonth, year: parsedYear } },
          update: {
            amount: parsedAmount,
            createdBy: session.id,
          },
          create: {
            familyId,
            month: parsedMonth,
            year: parsedYear,
            amount: parsedAmount,
            createdBy: session.id,
          },
        })

        let adjusted = []
        if (existing) {
          const delta = numericAmount - Number(existing.amount)
          if (delta !== 0) {
            adjusted = await propagateBudgetDelta(familyId, parsedMonth, parsedYear, delta, tx)
          }
        }

        return { budget: upserted, adjustedMonths: adjusted }
      })

      // WAJIB di-await sebelum return agar audit log 100% tersimpan di Vercel Serverless
      const remainingBalance = await getMonthRemainingBalance(parsedMonth, parsedYear, familyId)
      const balanceText =
        (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
        (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

      await logActivity({
        action: 'BUDGET_UPDATE',
        description: `${session.name} menetapkan kas utama bulan ${parsedMonth}/${parsedYear} sebesar ${formatRupiah(numericAmount)}${balanceText}`,
        details: {
          month: parsedMonth,
          year: parsedYear,
          amount: numericAmount,
          action,
          remainingBalance,
          adjustedMonths,
        },
        memberId: session.id,
        familyId,
      })

      return NextResponse.json({
        budget: { ...budget, amount: Number(budget.amount) },
      })
    }
  } catch (error) {
    console.error('Set budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
