// lib/format.js - Helper Format Angka & Tanggal

/**
 * Format angka ke format Rupiah Indonesia
 * Contoh: 1500000 -> "Rp 1.500.000"
 */
export function formatRupiah(amount) {
  if (amount === null || amount === undefined) return 'Rp 0'
  const num = typeof amount === 'bigint' ? Number(amount) : Number(amount)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format angka saja tanpa simbol Rp
 * Contoh: 1500000 -> "1.500.000"
 */
export function formatNumber(amount) {
  if (amount === null || amount === undefined) return '0'
  const num = typeof amount === 'bigint' ? Number(amount) : Number(amount)
  return new Intl.NumberFormat('id-ID').format(num)
}

/**
 * Parse string Rupiah kembali ke angka
 * Contoh: "1.500.000" -> 1500000
 */
export function parseRupiah(str) {
  return parseInt(str.replace(/\./g, '').replace(/[^0-9]/g, ''), 10) || 0
}

/**
 * Format tanggal ke format lokal
 * Contoh: 2025-03-15 -> "15 Maret 2025" (id) / "March 15, 2025" (en)
 */
export function formatDate(date, lang = 'id') {
  if (!date) return '-'
  const locale = lang === 'en' ? 'en-US' : lang === 'nl' ? 'nl-NL' : 'id-ID'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(date))
}

/**
 * Format tanggal singkat
 */
export function formatDateShort(date, lang = 'id') {
  if (!date) return '-'
  const locale = lang === 'en' ? 'en-US' : lang === 'nl' ? 'nl-NL' : 'id-ID'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(date))
}

/**
 * Format tanggal untuk input (YYYY-MM-DD)
 */
export function formatDateInput(date) {
  if (!date) return ''
  const d = new Date(date)
  try {
    return d.toISOString().split('T')[0]
  } catch (e) {
    return ''
  }
}

/**
 * Nama bulan dalam berbagai bahasa
 */
export const MONTH_NAMES = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  nl: ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
}

/**
 * Mendapatkan nama bulan
 */
export function getMonthName(month, lang = 'id') {
  const names = MONTH_NAMES[lang] || MONTH_NAMES.id
  return names[month - 1] || ''
}

/**
 * Format bulan dan tahun
 */
export function formatMonthYear(month, year, lang = 'id') {
  const names = MONTH_NAMES[lang] || MONTH_NAMES.id
  return `${names[month - 1]} ${year}`
}

/**
 * Kalkulasi persentase
 */
export function calcPercentage(value, total) {
  if (!total || total === 0) return 0
  return Math.round((Number(value) / Number(total)) * 100)
}

/**
 * Mendapatkan warna status sisa kas
 */
export function getBudgetStatusColor(remaining, total) {
  const pct = calcPercentage(remaining, total)
  if (pct <= 0) return 'danger'
  if (pct <= 20) return 'warning'
  if (pct <= 50) return 'caution'
  return 'success'
}
