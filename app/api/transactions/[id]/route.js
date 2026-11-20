// app/api/transactions/[id]/route.js - Edit & Delete Transaction (Atomic + Reliable Audit Log)

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
    const { itemName, amount, category, transactionDate, notes } = await request.json()

    const cleanItemName = typeof itemName === 'string' ? itemName.trim() : ''
    const numericAmount = Number(amount)
    const txDate = new Date(transactionDate)

    if (!cleanItemName || !category || !transactionDate || Number.isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Data transaksi tidak lengkap atau tanggal tidak valid' }, { status: 400 })
    }

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Jumlah harus berupa bilangan bulat lebih dari 0' }, { status: 400 })
    }

    const isAdmin = session.role === 'admin' || session.role === 'superadmin'

    // Baca data lama, validasi hak akses, update, dan sinkronkan kas dalam 1 transaksi atomik
    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } })
      if (!existing || existing.familyId !== familyId) {
        return { error: 'Transaksi tidak ditemukan', status: 404 }
      }

      const isOwner = existing.memberId === session.id
      const isWithin24h = (Date.now() - new Date(existing.createdAt).getTime()) < 24 * 60 * 60 * 1000
      if (!isAdmin && (!isOwner || !isWithin24h)) {
        return { error: 'Anda hanya bisa edit transaksi milik sendiri dalam 24 jam', status: 403 }
      }

      // Lindungi transaksi Top-Up agar tidak bisa secara tidak sengaja berubah kategori menjadi pengeluaran (dan sebaliknya)
      const safeCategory = existing.category === 'pemasukan' ? 'pemasukan' : (category === 'pemasukan' ? existing.category : category)

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          itemName: cleanItemName,
          amount: BigInt(numericAmount),
          category: safeCategory,
          transactionDate: txDate,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          editedById: session.id,
          editedByName: session.name,
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
        },
      })

      const adjustedMonths = await syncBudgetsForTransactionChange(existing, updated, { db: tx })
      return { transaction: existing, updated, adjustedMonths, safeCategory }
    })

    if (txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status })
    }

    const { transaction, updated, adjustedMonths, safeCategory } = txResult

    // WAJIB di-await sebelum return agar audit log 100% tersimpan di Vercel Serverless
    const txMonth = txDate.getUTCMonth() + 1
    const txYear = txDate.getUTCFullYear()
    const remainingBalance = await getMonthRemainingBalance(txMonth, txYear, familyId)
    const balanceText =
      (remainingBalance !== null ? ` • Sisa Saldo: ${formatRupiah(remainingBalance)}` : '') +
      (adjustedMonths.length ? ` • Kas disesuaikan: ${adjustedMonths.join(', ')}` : '')

    await logActivity({
      action: 'TRANSACTION_UPDATE',
      description: `${session.name} mengubah transaksi "${transaction.itemName}" (${formatRupiah(transaction.amount)}) menjadi "${cleanItemName}" (${formatRupiah(numericAmount)})${balanceText}`,
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
          itemName: cleanItemName,
          amount: numericAmount,
          category: safeCategory,
          transactionDate,
          notes: updated.notes,
        },
        remainingBalance,
        adjustedMonths,
      },
      memberId: session.id,
      familyId,
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

    const familyId = session.familyId || '1'
    const { id } = await params

    // Eksekusi hapus terlebih dahulu secara atomik; jika sudah terhapus (double-click),
    // deleteMany mengembalikan count === 0 sehingga syncBudgets TIDAK dijalankan dua kali!
    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } })
      if (!existing || existing.familyId !== familyId) {
        return { error: 'Transaksi tidak ditemukan', status: 404 }
      }

      const deleted = await tx.transaction.deleteMany({
        where: { id, familyId },
      })
      if (deleted.count === 0) {
        return { error: 'Transaksi sudah dihapus sebelumnya', status: 404 }
      }

      const adjustedMonths = await syncBudgetsForTransactionChange(existing, null, { db: tx })
      return { transaction: existing, adjustedMonths }
    })

    if (txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status })
    }

    const { transaction, adjustedMonths } = txResult

    // WAJIB di-await sebelum return agar audit log 100% tersimpan di Vercel Serverless
    const delDate = new Date(transaction.transactionDate)
    const delMonth = delDate.getUTCMonth() + 1
    const delYear = delDate.getUTCFullYear()
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
