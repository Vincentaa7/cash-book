// lib/cashbook.js - Logika terpusat untuk menjaga saldo kas tetap sinkron
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
    month, year,
    budgetDelta: isIncome ? amount : 0,
    remainingDelta: isIncome ? amount : -amount,
  }
}

async function incrementBudget(month, year, delta) {
  if (!delta) return false
  const existing = await prisma.monthlyBudget.findUnique({
    where: { uq_month_year: { month, year } },
  })
  if (!existing) return false
  await prisma.monthlyBudget.update({
    where: { uq_month_year: { month, year } },
    data: { amount: { increment: BigInt(delta) } },
  })
  return true
}

/**
 * Teruskan perubahan sisa saldo bulan (month, year) ke semua bulan berikutnya
 * yang saling bersambung (berhenti jika ada bulan tanpa kas).
 * Mengembalikan daftar bulan yang ikut disesuaikan.
 */
async function propagateToLaterMonths(month, year, delta) {
  const adjusted = []
  if (!delta) return adjusted
  const today = getAppToday()
  let m = month, y = year
  while (true) {
    m += 1
    if (m > 12) { m = 1; y += 1 }
    if (y > today.year || (y === today.year && m > today.month)) break
    const ok = await incrementBudget(m, y, delta)
    if (!ok) break
    adjusted.push(`${m}/${y}`)
  }
  return adjusted
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

  if (oldE) {
    // Batalkan efek lama
    await incrementBudget(oldE.month, oldE.year, -oldE.budgetDelta)
    const later = await propagateToLaterMonths(oldE.month, oldE.year, -oldE.remainingDelta)
    later.forEach(x => adjustedMonths.add(x))
  }
  if (newE) {
    // Terapkan efek baru
    if (!skipBudgetForNew) await incrementBudget(newE.month, newE.year, newE.budgetDelta)
    const later = await propagateToLaterMonths(newE.month, newE.year, newE.remainingDelta)
    later.forEach(x => adjustedMonths.add(x))
  }
  return [...adjustedMonths]
}
