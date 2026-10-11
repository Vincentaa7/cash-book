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

    // Sinkronkan kas: batalkan efek lama, terapkan efek baru (termasuk top-up
    // yang nominal/tanggal/kategorinya diubah) dan teruskan ke bulan-bulan berikutnya
    const adjustedMonths = await syncBudgetsForTransactionChange(transaction, updated)

    // Hitung sisa saldo setelah transaksi diubah
    const txDate = new Date(transactionDate)
    const txMonth = txDate.getUTCMonth() + 1
    const txYear = txDate.getUTCFullYear()
    const remainingBalance = await getMonthRemainingBalance(txMonth, txYear)
    const balanceText = (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
      (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

    // Catat log aktivitas edit
    await logActivity({
      action: 'TRANSACTION_UPDATE',
      description: `${session.name} mengubah transaksi "${transaction.itemName}" (${formatRupiah(transaction.amount)}) menjadi "${itemName}" (${formatRupiah(amount)})${balanceText}`,
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
        remainingBalance,
        adjustedMonths,
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

    // Hapus transaksi dari database
    await prisma.transaction.delete({ where: { id } })

    // ─────────────────────────────────────────────────────────────────
    // Sinkronkan kas: jika yang dihapus adalah top-up (pemasukan), kas
    // bulan itu dikurangi kembali. Jika transaksi bulan lampau, perubahan
    // sisa saldo diteruskan ke kas bulan-bulan berikutnya.
    // (Tidak lagi dibatasi minimal 0 agar selisih tidak "hilang".)
    // ─────────────────────────────────────────────────────────────────
    const adjustedMonths = await syncBudgetsForTransactionChange(transaction, null)

    // Hitung sisa saldo setelah transaksi dihapus
    const delDate = new Date(transaction.transactionDate)
    const delMonth = delDate.getUTCMonth() + 1
    const delYear = delDate.getUTCFullYear()
    const remainingBalance = await getMonthRemainingBalance(delMonth, delYear)
    const balanceText = (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
      (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

    // Catat log aktivitas hapus
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
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

