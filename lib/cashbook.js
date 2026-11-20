// lib/cashbook.js - Logika terpusat untuk menjaga saldo kas tetap sinkron per Keluarga
//
// Model saldo:
//   Kas bulan M        = Kas awal (pindahan sisa bulan lalu / set manual) + Top-up bulan M
//   Sisa saldo bulan M = Kas bulan M - Pengeluaran bulan M
//   Kas awal bulan M+1 = Sisa saldo bulan M (via pindah saldo)
//
// Karena kas bulan berikutnya adalah "snapshot" sisa bulan lalu, setiap perubahan
// pada transaksi bulan lampau (tambah/edit/hapus) harus diteruskan ke semua bulan
// sesudahnya yang sudah dibuat. Jika tidak, uang fisik dan catatan digital akan selisih.

import prisma from './db.js'

// Zona waktu fisik kas (Bali / WITA). Dipakai agar pergantian hari & bulan
// tidak bergantung pada zona waktu server (mis. Vercel = UTC).
export const APP_TIMEZONE = 'Asia/Makassar'

/** Tanggal & bulan "hari ini" menurut APP_TIMEZONE */
export function getAppToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = type => parseInt(parts.find(p => p.type === type).value, 10)
  const year = get('year'), month = get('month'), day = get('day')
  return { year, month, day, date: new Date(Date.UTC(year, month - 1, day)) }
}

/** Bulan & tahun dari kolom transactionDate (disimpan sebagai tanggal UTC) */
export function monthOf(date) {
  const d = new Date(date)
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() }
}

/**
 * Efek sebuah transaksi terhadap saldo:
 *  - pengeluaran: sisa saldo berkurang
 *  - pemasukan (top-up): kas bulan itu bertambah, sisa saldo bertambah
 */
function effectOf(tx) {
  if (!tx) return null
  const amount = Number(tx.amount)
  const { month, year } = monthOf(tx.transactionDate)
  const isIncome = tx.category === 'pemasukan'
  return {
    familyId: tx.familyId || '1',
    month,
    year,
    budgetDelta: isIncome ? amount : 0,
    remainingDelta: isIncome ? amount : -amount,
  }
}

/**
 * Cari daftar bulan-bulan berurutan setelah (month, year) yang sudah memiliki record MonthlyBudget.
 * Tidak dibatasi oleh today.month agar kebal terhadap perbedaan zona waktu saat pergantian bulan.
 */
async function findConsecutiveLaterBudgetMonths(familyId, month, year, db = prisma) {
  const fId = familyId || '1'
  const budgets = await db.monthlyBudget.findMany({
    where: {
      familyId: fId,
      OR: [
        { year: { gt: year } },
        { year, month: { gt: month } },
      ],
    },
    select: { month: true, year: true },
  })

  if (budgets.length === 0) return []

  const budgetSet = new Set(budgets.map(b => `${b.month}/${b.year}`))
  const result = []
  let m = month
  let y = year

  // Batasi loop defensif maksimal 120 bulan (10 tahun) untuk mencegah infinite loop
  for (let steps = 0; steps < 120; steps++) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    const key = `${m}/${y}`
    if (!budgetSet.has(key)) break
    result.push({ month: m, year: y, key })
  }

  return result
}

/**
 * Teruskan perubahan saldo kas (delta) bulan (month, year) ke semua bulan berikutnya
 * yang saling bersambung (berhenti jika ada bulan tanpa kas).
 * Mendukung Prisma transaction client (db) agar atomik.
 */
export async function propagateBudgetDelta(familyId, month, year, delta, db = prisma) {
  if (!delta) return []
  const fId = familyId || '1'
  const laterMonths = await findConsecutiveLaterBudgetMonths(fId, month, year, db)
  if (laterMonths.length === 0) return []

  for (const target of laterMonths) {
    await db.monthlyBudget.updateMany({
      where: { familyId: fId, month: target.month, year: target.year },
      data: { amount: { increment: BigInt(delta) } },
    })
  }

  return laterMonths.map(item => item.key)
}

/**
 * Sinkronkan kas bulanan setelah transaksi berubah.
 * Menggabungkan seluruh delta per (familyId, month, year) terlebih dahulu sehingga:
 *  - Tidak pernah mengeksekusi 2 update bertabrakan ke baris bulan yang sama
 *  - Mendukung eksekusi atomik di dalam prisma.$transaction melalui parameter `db`
 *
 * @param {object|null} oldTx  transaksi sebelum perubahan (null jika baru dibuat)
 * @param {object|null} newTx  transaksi setelah perubahan (null jika dihapus)
 * @param {object} opts.skipBudgetForNew  true jika kenaikan kas top-up baru sudah ditangani pemanggil
 * @param {object} opts.db     Prisma client atau interactive transaction client
 */
export async function syncBudgetsForTransactionChange(
  oldTx,
  newTx,
  { skipBudgetForNew = false, db = prisma } = {}
) {
  const oldE = effectOf(oldTx)
  const newE = effectOf(newTx)
  const familyId = newE?.familyId || oldE?.familyId || '1'

  // Kumpulkan semua delta bersih per bulan (key = "month/year")
  const deltaMap = new Map() // key -> { month, year, delta, isLaterPropagation }
  const addDelta = (month, year, delta, isLaterPropagation) => {
    if (!delta) return
    const key = `${month}/${year}`
    const existing = deltaMap.get(key)
    if (existing) {
      existing.delta += delta
      existing.isLaterPropagation = existing.isLaterPropagation || isLaterPropagation
    } else {
      deltaMap.set(key, { month, year, delta, isLaterPropagation })
    }
  }

  // Kasus khusus cepat: edit di bulan & tahun yang sama
  if (oldE && newE && oldE.familyId === newE.familyId && oldE.month === newE.month && oldE.year === newE.year) {
    const netBudgetDelta = (skipBudgetForNew ? 0 : newE.budgetDelta) - oldE.budgetDelta
    const netRemainingDelta = newE.remainingDelta - oldE.remainingDelta

    addDelta(newE.month, newE.year, netBudgetDelta, false)
    if (netRemainingDelta !== 0) {
      const laterMonths = await findConsecutiveLaterBudgetMonths(familyId, newE.month, newE.year, db)
      for (const lm of laterMonths) {
        addDelta(lm.month, lm.year, netRemainingDelta, true)
      }
    }
  } else {
    // Hitung kontribusi oldTx (dibatalkan) dan newTx (diterapkan) secara terpisah lalu gabungkan
    if (oldE) {
      addDelta(oldE.month, oldE.year, -oldE.budgetDelta, false)
      if (oldE.remainingDelta !== 0) {
        const laterOld = await findConsecutiveLaterBudgetMonths(oldE.familyId, oldE.month, oldE.year, db)
        for (const lm of laterOld) {
          addDelta(lm.month, lm.year, -oldE.remainingDelta, true)
        }
      }
    }
    if (newE) {
      if (!skipBudgetForNew) {
        addDelta(newE.month, newE.year, newE.budgetDelta, false)
      }
      if (newE.remainingDelta !== 0) {
        const laterNew = await findConsecutiveLaterBudgetMonths(newE.familyId, newE.month, newE.year, db)
        for (const lm of laterNew) {
          addDelta(lm.month, lm.year, newE.remainingDelta, true)
        }
      }
    }
  }

  const adjustedMonths = []
  // Terapkan semua delta non-nol secara deterministik dan berurutan (aman di dalam $transaction)
  const sortedEntries = [...deltaMap.entries()]
    .filter(([, v]) => v.delta !== 0)
    .sort((a, b) => (a[1].year !== b[1].year ? a[1].year - b[1].year : a[1].month - b[1].month))

  for (const [key, entry] of sortedEntries) {
    const res = await db.monthlyBudget.updateMany({
      where: { familyId, month: entry.month, year: entry.year },
      data: { amount: { increment: BigInt(entry.delta) } },
    })
    if (res.count > 0 && entry.isLaterPropagation) {
      adjustedMonths.push(key)
    }
  }

  return adjustedMonths
}
