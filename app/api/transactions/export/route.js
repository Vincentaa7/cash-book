// app/api/transactions/export/route.js - Export Transaksi ke CSV/Excel

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { formatRupiah, formatDate } from '@/lib/format'

export async function GET(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where = {}
    if (month && year) {
      const m = parseInt(month)
      const y = parseInt(year)
      where.transactionDate = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0),
      }
    } else if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { member: { select: { name: true } } },
      orderBy: { transactionDate: 'desc' },
    })

    // Build CSV
    const csvRows = [
      ['Tanggal', 'Nama Item', 'Kategori', 'Nominal', 'Dicatat Oleh', 'Catatan'],
      ...transactions.map(t => [
        formatDate(t.transactionDate),
        t.itemName,
        t.category,
        formatRupiah(Number(t.amount)),
        t.member?.name || '-',
        t.notes || '',
      ]),
    ]

    const csvContent = csvRows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const filename = `cash-book-${month ? `${year}-${month}` : 'export'}.csv`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
