// app/api/personal/[id]/route.js - Edit & Delete personal transaction (Atomic, Clamped >= 0, Cross-Month Safe)

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function PUT(request, { params }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { id } = await params
    const { itemName, amount, type, category, date, notes } = await request.json()
    const cleanItemName = typeof itemName === 'string' ? itemName.trim() : ''
    const numericAmount = Number(amount)
    const txDate = new Date(date)

    if (!cleanItemName || !category || !date || Number.isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Data tidak lengkap atau tanggal tidak valid' }, { status: 400 })
    }

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Nominal harus berupa bilangan bulat lebih dari 0' }, { status: 400 })
    }

    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.personalTransaction.findUnique({ where: { id } })
      if (!existing) {
        return { error: 'Tidak ditemukan', status: 404 }
      }
      if (existing.memberId !== session.id) {
        return { error: 'Akses ditolak', status: 403 }
      }

      const isTopup = existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income'
      // Kunci tipe & nama item untuk transaksi Top-Up agar tidak pernah terhitung ganda
      const safeType = isTopup ? 'income' : (type === 'income' ? 'income' : 'expense')
      const safeItemName = isTopup
        ? 'Tambah Saldo (Top-Up)'
        : (safeType === 'income' && cleanItemName.toLowerCase() === 'tambah saldo (top-up)'
            ? 'Tambah Saldo (Manual)'
            : cleanItemName)

      const updated = await tx.personalTransaction.update({
        where: { id },
        data: {
          itemName: safeItemName,
          amount:   BigInt(numericAmount),
          type:     safeType,
          category,
          date:     txDate,
          notes:    typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        },
      })

      // Jika transaksi adalah Top-Up Saldo Utama, sesuaikan personalBudget (termasuk jika pindah bulan & clamp >= 0)
      if (isTopup && tx.personalBudget) {
        const oldDate = new Date(existing.date)
        const oldMonth = oldDate.getUTCMonth() + 1
        const oldYear = oldDate.getUTCFullYear()
        const newMonth = txDate.getUTCMonth() + 1
        const newYear = txDate.getUTCFullYear()
        const oldAmt = Number(existing.amount)

        if (oldMonth === newMonth && oldYear === newYear) {
          const curBudget = await tx.personalBudget.findUnique({
            where: { uq_personal_budget: { memberId: session.id, month: oldMonth, year: oldYear } },
          })
          if (curBudget) {
            const nextVal = Math.max(0, Number(curBudget.amount) + (numericAmount - oldAmt))
            await tx.personalBudget.update({
              where: { id: curBudget.id },
              data: { amount: BigInt(nextVal) },
            })
          }
        } else {
          // Pindah bulan: kurangi bulan lama (clamp >= 0) dan tambahkan ke bulan baru
          const oldBudget = await tx.personalBudget.findUnique({
            where: { uq_personal_budget: { memberId: session.id, month: oldMonth, year: oldYear } },
          })
          if (oldBudget) {
            const nextOld = Math.max(0, Number(oldBudget.amount) - oldAmt)
            await tx.personalBudget.update({
              where: { id: oldBudget.id },
              data: { amount: BigInt(nextOld) },
            })
          }
          await tx.personalBudget.upsert({
            where: { uq_personal_budget: { memberId: session.id, month: newMonth, year: newYear } },
            update: { amount: { increment: BigInt(numericAmount) } },
            create: {
              memberId: session.id,
              month: newMonth,
              year: newYear,
              amount: BigInt(numericAmount),
            },
          })
        }
      }

      return { updated }
    })

    if (txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status })
    }

    return NextResponse.json({ item: { ...txResult.updated, amount: Number(txResult.updated.amount) } })
  } catch (error) {
    console.error('PUT personal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { id } = await params

    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.personalTransaction.findUnique({ where: { id } })
      if (!existing) {
        return { error: 'Tidak ditemukan', status: 404 }
      }
      if (existing.memberId !== session.id) {
        return { error: 'Akses ditolak', status: 403 }
      }

      const deleted = await tx.personalTransaction.deleteMany({
        where: { id, memberId: session.id },
      })
      if (deleted.count === 0) {
        return { error: 'Sudah dihapus sebelumnya', status: 404 }
      }

      // Jika transaksi yang dihapus adalah Top-Up Saldo Utama, kurangi personalBudget secara atomik & clamp >= 0
      if (existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income' && tx.personalBudget) {
        const oldDate = new Date(existing.date)
        const oldMonth = oldDate.getUTCMonth() + 1
        const oldYear = oldDate.getUTCFullYear()
        const curBudget = await tx.personalBudget.findUnique({
          where: { uq_personal_budget: { memberId: session.id, month: oldMonth, year: oldYear } },
        })
        if (curBudget) {
          const nextVal = Math.max(0, Number(curBudget.amount) - Number(existing.amount))
          await tx.personalBudget.update({
            where: { id: curBudget.id },
            data: { amount: BigInt(nextVal) },
          })
        }
      }

      return { ok: true }
    })

    if (txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE personal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}
