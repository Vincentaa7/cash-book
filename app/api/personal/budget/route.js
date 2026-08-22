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
    const parsedMonth  = parseInt(month)
    const parsedYear   = parseInt(year)
    const parsedAmount = BigInt(amount)

    if (!month || !year || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Data saldo tidak valid' }, { status: 400 })
    }

    let resultAmount = Number(parsedAmount)

    if (action === 'add') {
      // Top-up: Tambah ke saldo utama
      if (prisma.personalBudget) {
        const existing = await prisma.personalBudget.findUnique({
          where: {
            uq_personal_budget: {
              memberId: session.id,
              month: parsedMonth,
              year:  parsedYear,
            },
          },
        })

        if (existing) {
          const updated = await prisma.personalBudget.update({
            where: { id: existing.id },
            data: { amount: { increment: parsedAmount } },
          })
          resultAmount = Number(updated.amount)
        } else {
          const created = await prisma.personalBudget.create({
            data: {
              memberId: session.id,
              month: parsedMonth,
              year:  parsedYear,
              amount: parsedAmount,
            },
          })
          resultAmount = Number(created.amount)
        }
      } else {
        const existing = await prisma.$queryRaw`
          SELECT id, amount FROM personal_budgets
          WHERE member_id = ${session.id} AND month = ${parsedMonth} AND year = ${parsedYear}
          LIMIT 1
        `
        if (existing.length > 0) {
          await prisma.$executeRaw`
            UPDATE personal_budgets
            SET amount = amount + ${parsedAmount}, updated_at = NOW()
            WHERE id = ${existing[0].id}
          `
          resultAmount = Number(existing[0].amount) + Number(parsedAmount)
        } else {
          await prisma.$executeRaw`
            INSERT INTO personal_budgets (id, member_id, month, year, amount, created_at, updated_at)
            VALUES (UUID(), ${session.id}, ${parsedMonth}, ${parsedYear}, ${parsedAmount}, NOW(), NOW())
          `
          resultAmount = Number(parsedAmount)
        }
      }

      // Catat transaksi kas masuk (top-up) ke catatan pribadi
      let txDate = new Date()
      if (txDate.getMonth() + 1 !== parsedMonth || txDate.getFullYear() !== parsedYear) {
        txDate = new Date(parsedYear, parsedMonth - 1, 1)
      }

      if (prisma.personalTransaction) {
        await prisma.personalTransaction.create({
          data: {
            memberId: session.id,
            itemName: 'Tambah Saldo (Top-Up)',
            amount:   parsedAmount,
            type:     'income',
            category: 'tabungan',
            date:     txDate,
            notes:    notes?.trim() || 'Top-up saldo utama kas pribadi',
          },
        })
      } else {
        await prisma.$executeRaw`
          INSERT INTO personal_transactions (id, member_id, item_name, amount, type, category, date, notes, created_at, updated_at)
          VALUES (UUID(), ${session.id}, 'Tambah Saldo (Top-Up)', ${parsedAmount}, 'income', 'tabungan', ${txDate}, ${notes?.trim() || 'Top-up saldo utama kas pribadi'}, NOW(), NOW())
        `
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
