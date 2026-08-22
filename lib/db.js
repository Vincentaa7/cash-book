import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

let prisma = globalForPrisma.prisma

// Pastikan instance Prisma Client memiliki semua model terbaru
if (!prisma || !prisma.personalTransaction || !prisma.personalBudget) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
  }
}

export default prisma
