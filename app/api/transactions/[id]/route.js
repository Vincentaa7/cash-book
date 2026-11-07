// app/api/transactions/[id]/route.js - Edit & Delete Transaction

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { formatRupiah } from '@/lib/format'
import { syncBudgetsForTransactionChange } from '@/lib/cashbook'

export async function PUT(request, { params }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'
    const { id } = await params
    const transaction = await prisma.transaction.findUnique({ where: { id } })

    if (!transaction || transaction.familyId !== familyId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Cek akses: admin bisa edit semua, member hanya edit miliknya dalam 24 jam
    const isAdmin = session.role === 'admin' || session.role !== undefined && session.role === 'superadmin'
    const isOwner = transaction.memberId === session.id
    const isWithin24h = (Date.now() - new Date(transaction.createdAt).getTime()) < 24 * 60 * 60 * 1000

    if (!isAdmin && (!isOwner || !isWithin24h)) {
      return NextResponse.json(
        { error: 'Anda hanya bisa edit transaksi milik sendiri dalam 24 jam' },
        { status: 403 }
      )
    }

    const { itemName, amount, category, transactionDate, notes } = await request.json()
    const numericAmount = Number(amount)
    const txDate = new Date(transactionDate)

    // Jalankan update transaksi & sinkronisasi kas secara paralel
    const [updated, adjustedMonths] = await Promise.all([
      prisma.transaction.update({
        where: { id },
        data: {
          itemName,
          amount: BigInt(numericAmount),
          category,
          transactionDate: txDate,
          notes: notes || null,
          editedById: session.id,
          editedByName: session.name,
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
      }),
      syncBudgetsForTransactionChange(transaction, {
        familyId,
        amount: numericAmount,
        category,
        transactionDate: txDate,
      }),
    ])

    // Hitung sisa saldo & catat log aktivitas di background tanpa menahan respons UI
    const txMonth = txDate.getUTCMonth() + 1
    const txYear = txDate.getUTCFullYear()
    void (async () => {
      try {
        const remainingBalance = await getMonthRemainingBalance(txMonth, txYear, familyId)
        const balanceText =
          (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
          (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

        await logActivity({
          action: 'TRANSACTION_UPDATE',
          description: `${session.name} mengubah transaksi "${transaction.itemName}" (${formatRupiah(transaction.amount)}) menjadi "${itemName}" (${formatRupiah(numericAmount)})${balanceText}`,
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
              amount: numericAmount,
              category,
              transactionDate,
              notes,
            },
            remainingBalance,
            adjustedMonths,
          },
          memberId: session.id,
          familyId,
        })
      } catch (err) {
        console.error('Background logActivity update error:', err)
      }
    })()

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

    const familyId = session.familyId || '1'
    const { id } = await params
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction || transaction.familyId !== familyId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Hapus transaksi & sinkronkan kas secara paralel
    const [, adjustedMonths] = await Promise.all([
      prisma.transaction.delete({ where: { id } }),
      syncBudgetsForTransactionChange(transaction, null),
    ])

    // Hitung sisa saldo & catat log aktivitas hapus di background
    const delDate = new Date(transaction.transactionDate)
    const delMonth = delDate.getUTCMonth() + 1
    const delYear = delDate.getUTCFullYear()
    void (async () => {
      try {
        const remainingBalance = await getMonthRemainingBalance(delMonth, delYear, familyId)
        const balanceText =
          (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
          (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

        await logActivity({
          action: 'TRANSACTION_DELETE',
          description: `${session.name} menghapus transaksi "${transaction.itemName}" sebesar ${formatRupiah(transaction.amount)}${balanceText}`,
          details: {
            id,
            itemName: transaction.itemName,
            amount: Number(transaction.amount),
            category: transaction.category,
            transactionDate: transaction.transactionDate.toISOString().split('T')[0],
            notes: transaction.notes,
            remainingBalance,
            adjustedMonths,
          },
          memberId: session.id,
          familyId,
        })
      } catch (err) {
        console.error('Background logActivity delete error:', err)
      }
    })()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
