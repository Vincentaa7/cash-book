// lib/logger.js - Helper untuk mencatat Log Aktivitas (Audit Trail) per Keluarga
import prisma from './db'

export async function logActivity({ action, description, details = null, memberId = null, familyId = '1', db = prisma }) {
  try {
    await db.activityLog.create({
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
 * Menghitung sisa saldo kas (Budget - (Pengeluaran Aktif + Arsip Snapshot))
 * untuk keluarga, bulan & tahun tertentu.
 */
export async function getMonthRemainingBalance(month, year, familyId = '1', db = prisma) {
  try {
    const fId = familyId || '1'
    const parsedMonth = parseInt(month, 10)
    const parsedYear = parseInt(year, 10)
    const firstDay = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))
    const lastDay = new Date(Date.UTC(parsedYear, parsedMonth, 0, 23, 59, 59, 999))

    const [budget, expense, archivedExpense] = await Promise.all([
      db.monthlyBudget.findUnique({
        where: { uq_month_year: { familyId: fId, month: parsedMonth, year: parsedYear } }
      }),
      db.transaction.aggregate({
        where: {
          familyId: fId,
          transactionDate: { gte: firstDay, lte: lastDay },
          category: { not: 'pemasukan' }
        },
        _sum: { amount: true }
      }),
      db.monthlySnapshot.aggregate({
        where: {
          familyId: fId,
          month: parsedMonth,
          year: parsedYear,
          category: { not: 'pemasukan' }
        },
        _sum: { totalAmount: true }
      }),
    ])

    const totalBudget = budget ? Number(budget.amount) : 0
    const totalExpense = Number(expense._sum.amount || 0) + Number(archivedExpense._sum.totalAmount || 0)
    return totalBudget - totalExpense
  } catch (error) {
    console.error('Failed to get month remaining balance for logger:', error)
    return null
  }
}
