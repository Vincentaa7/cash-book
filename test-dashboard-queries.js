// test-dashboard-queries.js - Script untuk menguji query dashboard Prisma secara langsung
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function test() {
  try {
    const month = 6
    const year = 2026
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)

    console.log("1. Menguji query monthlyBudget...")
    const budget = await prisma.monthlyBudget.findUnique({
      where: { uq_month_year: { month, year } },
    })
    console.log("Budget:", budget)

    console.log("2. Menguji query transactions...")
    const transactions = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: firstDay, lte: lastDay },
      },
      include: { member: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { transactionDate: 'asc' },
    })
    console.log("Transactions count:", transactions.length)

    console.log("3. Menguji query recent transactions...")
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      include: { member: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
    })
    console.log("Recent transactions count:", recentTransactions.length)

    console.log("4. Menguji query appSettings...")
    const settings = await prisma.appSettings.findUnique({ where: { id: '1' } })
    console.log("Settings:", settings)

    console.log("5. Menguji query monthlyTrends (6 bulan)...")
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    cutoffDate.setHours(0, 0, 0, 0)
    console.log("Cutoff date:", cutoffDate)
    
    // Test salah satu snapshot/trends
    const snapshotAgg = await prisma.monthlySnapshot.aggregate({
      where: { month: 5, year: 2026 },
      _sum: { totalAmount: true },
    })
    console.log("Snapshot agg:", snapshotAgg)

    console.log("SEMUA QUERY BERHASIL DILAKUKAN TANPA ERROR!")
  } catch (error) {
    console.error("Gagal melakukan query:")
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

test()
