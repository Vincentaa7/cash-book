// app/api/transactions/[id]/route.js - Edit & Delete Transaction

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'

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
    const isAdmin = session.role === 'admin' || session.role === 'superadmin'
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
        editedById: session.id,
        editedByName: session.name,
      },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    // Catat log aktivitas edit
    await logActivity({
      action: 'TRANSACTION_UPDATE',
      description: `${session.name} mengubah transaksi "${transaction.itemName}" (${formatRupiah(transaction.amount)}) menjadi "${itemName}" (${formatRupiah(amount)})`,
      details: {
        id,
        old: {
          itemName: transaction.itemName,
          amount: Number(transaction.amount),
          category: transaction.category,
          transactionDate: transaction.transactionDate.toISOString().split('T')[0],
          notes: transaction.notes,
        },
        new: {
          itemName,
          amount,
          category,
          transactionDate,
          notes,
        },
      },
      memberId: session.id,
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
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Hanya admin yang bisa menghapus transaksi' }, { status: 403 })
    }

    const { id } = await params
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    await prisma.transaction.delete({ where: { id } })

    // Catat log aktivitas hapus
    await logActivity({
      action: 'TRANSACTION_DELETE',
      description: `${session.name} menghapus transaksi "${transaction.itemName}" sebesar ${formatRupiah(transaction.amount)}`,
      details: {
        id,
        itemName: transaction.itemName,
        amount: Number(transaction.amount),
        category: transaction.category,
        transactionDate: transaction.transactionDate.toISOString().split('T')[0],
        notes: transaction.notes,
      },
      memberId: session.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
