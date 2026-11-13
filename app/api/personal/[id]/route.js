// app/api/personal/[id]/route.js - Edit & Delete personal transaction

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
    const existing = await prisma.personalTransaction.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }

    // Hanya pemilik sendiri yang bisa edit
    if (existing.memberId !== session.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { itemName, amount, type, category, date, notes } = await request.json()

    const updated = await prisma.personalTransaction.update({
      where: { id },
      data: {
        itemName: itemName.trim(),
        amount:   BigInt(amount),
        type:     type || 'expense',
        category,
        date:     new Date(date),
        notes:    notes?.trim() || null,
      },
    })

    // Jika transaksi adalah Top-Up Saldo Utama, sesuaikan juga personalBudget bulan terkait
    if (existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income' && prisma.personalBudget) {
      const oldDate = new Date(existing.date)
      const oldMonth = oldDate.getUTCMonth() + 1
      const oldYear = oldDate.getUTCFullYear()
      const delta = BigInt(amount) - BigInt(existing.amount)
      if (delta !== 0n) {
        await prisma.personalBudget.updateMany({
          where: { memberId: session.id, month: oldMonth, year: oldYear },
          data: { amount: { increment: delta } },
        })
      }
    }

    return NextResponse.json({ item: { ...updated, amount: Number(updated.amount) } })
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
    const existing = await prisma.personalTransaction.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }

    // Hanya pemilik sendiri yang bisa hapus
    if (existing.memberId !== session.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    await prisma.personalTransaction.delete({ where: { id } })

    // Jika transaksi yang dihapus adalah Top-Up Saldo Utama, kurangi juga personalBudget bulan terkait
    if (existing.itemName === 'Tambah Saldo (Top-Up)' && existing.type === 'income' && prisma.personalBudget) {
      const oldDate = new Date(existing.date)
      const oldMonth = oldDate.getUTCMonth() + 1
      const oldYear = oldDate.getUTCFullYear()
      await prisma.personalBudget.updateMany({
        where: { memberId: session.id, month: oldMonth, year: oldYear },
        data: { amount: { decrement: BigInt(existing.amount) } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE personal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server: ' + (error.message || String(error)) }, { status: 500 })
  }
}
