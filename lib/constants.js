// lib/constants.js - Konstanta Aplikasi

/**
 * Daftar kategori pengeluaran
 */
export const CATEGORIES = [
  { id: 'sembako', label: 'Kebutuhan Dapur / Sembako', emoji: '🛒', color: '#10b981' },
  { id: 'kebersihan', label: 'Kebersihan & Perawatan', emoji: '🧴', color: '#06b6d4' },
  { id: 'kesehatan', label: 'Kesehatan & Obat', emoji: '🏥', color: '#ef4444' },
  { id: 'pendidikan', label: 'Pendidikan', emoji: '📚', color: '#3b82f6' },
  { id: 'tagihan', label: 'Tagihan & Utilitas', emoji: '🔌', color: '#f59e0b' },
  { id: 'makan', label: 'Makan & Jajan', emoji: '🍔', color: '#f97316' },
  { id: 'pakaian', label: 'Pakaian & Perlengkapan', emoji: '👕', color: '#8b5cf6' },
  { id: 'rumah', label: 'Perbaikan Rumah', emoji: '🔧', color: '#64748b' },
  { id: 'hiburan', label: 'Hiburan & Rekreasi', emoji: '🎉', color: '#ec4899' },
  { id: 'lainnya', label: 'Lainnya', emoji: '📦', color: '#94a3b8' },
]

/**
 * Pilihan warna avatar anggota
 */
export const AVATAR_COLORS = [
  { value: '#0d9488', label: 'Hijau Teal' },
  { value: '#dc2626', label: 'Merah' },
  { value: '#7c3aed', label: 'Ungu' },
  { value: '#2563eb', label: 'Biru' },
  { value: '#d97706', label: 'Oranye' },
  { value: '#db2777', label: 'Pink' },
  { value: '#059669', label: 'Hijau' },
  { value: '#0891b2', label: 'Cyan' },
]

/**
 * Preset rentang tanggal
 */
export const DATE_PRESETS = [
  { id: '7days', label: '7 Hari Terakhir' },
  { id: '30days', label: '30 Hari Terakhir' },
  { id: 'this_month', label: 'Bulan Ini' },
  { id: 'last_month', label: 'Bulan Lalu' },
]

/**
 * Roles yang tersedia
 */
export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
}

/**
 * Mendapatkan info kategori berdasarkan label
 */
export function getCategoryInfo(label) {
  return CATEGORIES.find(c => c.label === label) || {
    id: 'lainnya',
    label: label || 'Lainnya',
    emoji: '📦',
    color: '#94a3b8',
  }
}

/**
 * Mendapatkan initial dari nama untuk avatar
 */
export function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
