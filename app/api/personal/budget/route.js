// app/api/personal/budget/route.js - Saldo Utama & Top-Up Kas Pribadi API

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
    const month = parseInt(searchParams.get('month')) || (new Date().getMonth() + 1)
    const year  = parseInt(searchParams.get('year'))  || new Date().getFullYear()

    let budget = null
    if (prisma.personalBudget) {
      budget = await prisma.personalBudget.findUnique({
        where: {
          uq_personal_budget: {
            memberId: session.id,
            month,
            year,
          },
        },
      })
    } else {
      const rows = await prisma.$queryRaw`
        SELECT id, member_id as memberId, month, year, amount, created_at as createdAt, updated_at as updatedAt
        FROM personal_budgets
        WHERE member_id = ${session.id} AND month = ${month} AND year = ${year}
        LIMIT 1
      `
      budget = rows.length > 0 ? rows[0] : null
    }

    return NextResponse.json({
      budget: budget ? { ...budget, amount: Number(budget.amount) } : null,
    })
  } catch (error) {
    console.error('GET personal budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { month, year, amount, action = 'set', notes } = await request.json()
    const parsedMonth  = parseInt(month, 10)
    const parsedYear   = parseInt(year, 10)
    const numericAmount = Number(amount)

    if (
      !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 ||
      !Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2100 ||
      !Number.isSafeInteger(numericAmount) || numericAmount <= 0
    ) {
      return NextResponse.json({ error: 'Data saldo tidak valid (nominal harus bilangan bulat > 0)' }, { status: 400 })
    }

    const parsedAmount = BigInt(numericAmount)
    let resultAmount = numericAmount

    if (action === 'add') {
      const now = new Date()
      let txDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
      if (now.getMonth() + 1 !== parsedMonth || now.getFullYear() !== parsedYear) {
        txDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))
      }

      // Top-up: Eksekusi upsert saldo utama & pencatatan transaksi masuk secara atomik
      if (prisma.personalBudget && prisma.personalTransaction) {
        const [upsertedBudget] = await prisma.$transaction([
          prisma.personalBudget.upsert({
            where: {
              uq_personal_budget: {
                memberId: session.id,
                month: parsedMonth,
                year:  parsedYear,
              },
            },
            update: { amount: { increment: parsedAmount } },
            create: {
              memberId: session.id,
              month: parsedMonth,
              year:  parsedYear,
              amount: parsedAmount,
            },
          }),
          prisma.personalTransaction.create({
            data: {
              memberId: session.id,
              itemName: 'Tambah Saldo (Top-Up)',
              amount:   parsedAmount,
              type:     'income',
              category: 'tabungan',
              date:     txDate,
              notes:    notes?.trim() || 'Top-up saldo utama kas pribadi',
            },
          }),
        ])
        resultAmount = Number(upsertedBudget.amount)
      } else {
        await Promise.all([
          prisma.$executeRaw`
            INSERT INTO personal_budgets (id, member_id, month, year, amount, created_at, updated_at)
            VALUES (UUID(), ${session.id}, ${parsedMonth}, ${parsedYear}, ${parsedAmount}, NOW(), NOW())
            ON DUPLICATE KEY UPDATE amount = amount + ${parsedAmount}, updated_at = NOW()
          `,
          prisma.$executeRaw`
            INSERT INTO personal_transactions (id, member_id, item_name, amount, type, category, date, notes, created_at, updated_at)
            VALUES (UUID(), ${session.id}, 'Tambah Saldo (Top-Up)', ${parsedAmount}, 'income', 'tabungan', ${txDate}, ${notes?.trim() || 'Top-up saldo utama kas pribadi'}, NOW(), NOW())
          `,
        ])
        const rows = await prisma.$queryRaw`
          SELECT amount FROM personal_budgets
          WHERE member_id = ${session.id} AND month = ${parsedMonth} AND year = ${parsedYear}
          LIMIT 1
        `
        if (rows.length > 0) resultAmount = Number(rows[0].amount)
      }
    } else {
      // Set saldo utama
      if (prisma.personalBudget) {
        const budget = await prisma.personalBudget.upsert({
          where: {
            uq_personal_budget: {
              memberId: session.id,
              month: parsedMonth,
              year:  parsedYear,
            },
          },
          update: { amount: parsedAmount },
          create: {
            memberId: session.id,
            month:    parsedMonth,
            year:     parsedYear,
            amount:   parsedAmount,
          },
        })
        resultAmount = Number(budget.amount)
      } else {
        await prisma.$executeRaw`
          INSERT INTO personal_budgets (id, member_id, month, year, amount, created_at, updated_at)
          VALUES (UUID(), ${session.id}, ${parsedMonth}, ${parsedYear}, ${parsedAmount}, NOW(), NOW())
          ON DUPLICATE KEY UPDATE amount = ${parsedAmount}, updated_at = NOW()
        `
        resultAmount = Number(parsedAmount)
      }
    }

    return NextResponse.json({
      success: true,
      budget: {
        memberId: session.id,
        month: parsedMonth,
        year: parsedYear,
        amount: resultAmount,
      },
    })
  } catch (error) {
    console.error('POST personal budget error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}
