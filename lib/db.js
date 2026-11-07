import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

let prisma = globalForPrisma.prisma

// Pastikan instance Prisma Client memiliki semua model terbaru & di-cache di globalThis
// baik di development maupun warm serverless production (Vercel) untuk mencegah cold-connection berulang
if (!prisma || !prisma.personalTransaction || !prisma.personalBudget) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  globalForPrisma.prisma = prisma
}

export default prisma
