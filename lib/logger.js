// lib/logger.js - Helper untuk mencatat Log Aktivitas (Audit Trail) per Keluarga
import prisma from './db'

export async function logActivity({ action, description, details = null, memberId = null, familyId = '1' }) {
  try {
    await prisma.activityLog.create({
      data: {
        familyId: familyId || '1',
        action,
        description,
        details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        memberId,
      },
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

/**
 * Menghitung sisa saldo kas (Budget - Total Pengeluaran) untuk keluarga, bulan & tahun tertentu
 */
export async function getMonthRemainingBalance(month, year, familyId = '1') {
  try {
    const fId = familyId || '1'
    const firstDay = new Date(Date.UTC(year, month - 1, 1))
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    const [budget, expense] = await Promise.all([
      prisma.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId: fId, month: parseInt(month), year: parseInt(year) } }
      }),
      prisma.transaction.aggregate({
        where: {
          familyId: fId,
          transactionDate: { gte: firstDay, lte: lastDay },
          category: { not: 'pemasukan' }
        },
        _sum: { amount: true }
      })
    ])

    const totalBudget = budget ? Number(budget.amount) : 0
    const totalExpense = Number(expense._sum.amount || 0)
    return totalBudget - totalExpense
  } catch (error) {
    console.error('Failed to get month remaining balance for logger:', error)
    return null
  }
}
