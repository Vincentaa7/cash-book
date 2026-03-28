// app/api/transactions/[id]/route.js - Edit & Delete Transaction

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
    const transaction = await prisma.transaction.findUnique({ where: { id } })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Cek akses: admin bisa edit semua, member hanya edit miliknya dalam 24 jam
    const isAdmin = session.role === 'admin'
    const isOwner = transaction.memberId === session.id
    const isWithin24h = (Date.now() - new Date(transaction.createdAt).getTime()) < 24 * 60 * 60 * 1000

    if (!isAdmin && (!isOwner || !isWithin24h)) {
      return NextResponse.json(
        { error: 'Anda hanya bisa edit transaksi milik sendiri dalam 24 jam' },
        { status: 403 }
      )
    }

    const { itemName, amount, category, transactionDate, notes } = await request.json()

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        itemName,
        amount: BigInt(amount),
        category,
        transactionDate: new Date(transactionDate),
        notes: notes || null,
      },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    return NextResponse.json({
      transaction: { ...updated, amount: Number(updated.amount) },
    })
  } catch (error) {
    console.error('Update transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menghapus transaksi' }, { status: 403 })
    }

    const { id } = await params
    await prisma.transaction.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
