// app/api/personal/[id]/route.js - Edit & Delete personal transaction (Atomic + Validated)

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

      const safeType = existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income'
        ? 'income'
        : (type === 'income' ? 'income' : 'expense')

      const updated = await tx.personalTransaction.update({
        where: { id },
        data: {
          itemName: cleanItemName,
          amount:   BigInt(numericAmount),
          type:     safeType,
          category,
          date:     txDate,
          notes:    typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        },
      })

      // Jika transaksi adalah Top-Up Saldo Utama, sesuaikan juga personalBudget bulan terkait secara atomik
      if (existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income' && tx.personalBudget) {
        const oldDate = new Date(existing.date)
        const oldMonth = oldDate.getUTCMonth() + 1
        const oldYear = oldDate.getUTCFullYear()
        const delta = BigInt(numericAmount) - BigInt(existing.amount)
        if (delta !== 0n) {
          await tx.personalBudget.updateMany({
            where: { memberId: session.id, month: oldMonth, year: oldYear },
            data: { amount: { increment: delta } },
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

      // Jika transaksi yang dihapus adalah Top-Up Saldo Utama, kurangi juga personalBudget bulan terkait secara atomik
      if (existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income' && tx.personalBudget) {
        const oldDate = new Date(existing.date)
        const oldMonth = oldDate.getUTCMonth() + 1
        const oldYear = oldDate.getUTCFullYear()
        await tx.personalBudget.updateMany({
          where: { memberId: session.id, month: oldMonth, year: oldYear },
          data: { amount: { decrement: BigInt(existing.amount) } },
        })
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
