// lib/cashbook.js - Logika terpusat untuk menjaga saldo kas tetap sinkron per Keluarga
//
// Model saldo:
//   Kas bulan M        = Kas awal (pindahan sisa bulan lalu / set manual) + Top-up bulan M
//   Sisa saldo bulan M = Kas bulan M - Pengeluaran bulan M
//   Kas awal bulan M+1 = Sisa saldo bulan M (via pindah saldo)
//
// Karena kas bulan berikutnya adalah "snapshot" sisa bulan lalu, setiap perubahan
// pada transaksi bulan lampau (tambah/edit/hapus) harus diteruskan ke semua bulan
// sesudahnya. Jika tidak, uang fisik dan catatan digital akan selisih.

import prisma from './db'

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
    month, year,
    budgetDelta: isIncome ? amount : 0,
    remainingDelta: isIncome ? amount : -amount,
  }
}

async function incrementBudget(familyId, month, year, delta) {
  if (!delta) return false
  const fId = familyId || '1'
  // Satu round-trip langsung dengan updateMany (tanpa findUnique terlebih dahulu)
  const res = await prisma.monthlyBudget.updateMany({
    where: { familyId: fId, month, year },
    data: { amount: { increment: BigInt(delta) } },
  })
  return res.count > 0
}

/**
 * Teruskan perubahan sisa saldo bulan (month, year) ke semua bulan berikutnya
 * yang saling bersambung (berhenti jika ada bulan tanpa kas).
 * Dioptimasi: 0 query jika transaksi di bulan berjalan, atau 1x findMany + 1x paralel update
 * (menggantikan sequential while-loop waterfall 2N query).
 */
async function propagateToLaterMonths(familyId, month, year, delta) {
  const adjusted = []
  if (!delta) return adjusted
  const today = getAppToday()

  // Fast-path: jika transaksi berada di bulan berjalan (atau masa depan), tidak ada bulan setelahnya
  if (year > today.year || (year === today.year && month >= today.month)) {
    return adjusted
  }

  const fId = familyId || '1'
  // Ambil seluruh bulan kas dari tahun transaksi s/d tahun ini dalam 1 query ringan
  const budgets = await prisma.monthlyBudget.findMany({
    where: {
      familyId: fId,
      year: { gte: year, lte: today.year },
    },
    select: { month: true, year: true },
  })

  const budgetSet = new Set(budgets.map(b => `${b.month}/${b.year}`))
  const monthsToUpdate = []
  let m = month, y = year

  while (true) {
    m += 1
    if (m > 12) { m = 1; y += 1 }
    if (y > today.year || (y === today.year && m > today.month)) break
    const key = `${m}/${y}`
    if (!budgetSet.has(key)) break
    monthsToUpdate.push({ m, y, key })
  }

  if (monthsToUpdate.length === 0) return adjusted

  // Eksekusi semua update bulan berikutnya secara paralel dalam 1 batch
  await Promise.all(
    monthsToUpdate.map(({ m: targetM, y: targetY }) =>
      prisma.monthlyBudget.updateMany({
        where: { familyId: fId, month: targetM, year: targetY },
        data: { amount: { increment: BigInt(delta) } },
      })
    )
  )

  return monthsToUpdate.map(item => item.key)
}

/**
 * Sinkronkan kas bulanan setelah transaksi berubah.
 * @param {object|null} oldTx  transaksi sebelum perubahan (null jika baru dibuat)
 * @param {object|null} newTx  transaksi setelah perubahan (null jika dihapus)
 * @param {object} opts.skipBudgetForNew  true jika kenaikan kas top-up baru sudah ditangani pemanggil
 */
export async function syncBudgetsForTransactionChange(oldTx, newTx, { skipBudgetForNew = false } = {}) {
  const adjustedMonths = new Set()
  const oldE = effectOf(oldTx)
  const newE = effectOf(newTx)

  // Optimisasi: jika edit transaksi di bulan & tahun yang sama, gabungkan delta bersih dalam 1 langkah
  if (oldE && newE && oldE.familyId === newE.familyId && oldE.month === newE.month && oldE.year === newE.year) {
    const netBudgetDelta = (skipBudgetForNew ? 0 : newE.budgetDelta) - oldE.budgetDelta
    const netRemainingDelta = newE.remainingDelta - oldE.remainingDelta
    const [, later] = await Promise.all([
      incrementBudget(newE.familyId, newE.month, newE.year, netBudgetDelta),
      propagateToLaterMonths(newE.familyId, newE.month, newE.year, netRemainingDelta),
    ])
    later.forEach(x => adjustedMonths.add(x))
    return [...adjustedMonths]
  }

  const tasks = []
  if (oldE) {
    tasks.push(
      Promise.all([
        incrementBudget(oldE.familyId, oldE.month, oldE.year, -oldE.budgetDelta),
        propagateToLaterMonths(oldE.familyId, oldE.month, oldE.year, -oldE.remainingDelta),
      ]).then(([, later]) => later.forEach(x => adjustedMonths.add(x)))
    )
  }
  if (newE) {
    tasks.push(
      Promise.all([
        !skipBudgetForNew ? incrementBudget(newE.familyId, newE.month, newE.year, newE.budgetDelta) : Promise.resolve(false),
        propagateToLaterMonths(newE.familyId, newE.month, newE.year, newE.remainingDelta),
      ]).then(([, later]) => later.forEach(x => adjustedMonths.add(x)))
    )
  }

  if (tasks.length > 0) {
    await Promise.all(tasks)
  }
  return [...adjustedMonths]
}
