// lib/constants.js - Konstanta Aplikasi

/**
 * Daftar kategori pengeluaran
 */
export const CATEGORIES = [
  { id: 'sembako', labelKey: 'cat_sembako', emoji: '🛒', color: '#10b981' },
  { id: 'kebersihan', labelKey: 'cat_kebersihan', emoji: '🧴', color: '#06b6d4' },
  { id: 'kesehatan', labelKey: 'cat_kesehatan', emoji: '🏥', color: '#ef4444' },
  { id: 'pendidikan', labelKey: 'cat_pendidikan', emoji: '📚', color: '#3b82f6' },
  { id: 'tagihan', labelKey: 'cat_tagihan', emoji: '🔌', color: '#f59e0b' },
  { id: 'makan', labelKey: 'cat_makan', emoji: '🍔', color: '#f97316' },
  { id: 'pakaian', labelKey: 'cat_pakaian', emoji: '👕', color: '#8b5cf6' },
  { id: 'rumah', labelKey: 'cat_rumah', emoji: '🔧', color: '#64748b' },
  { id: 'hiburan', labelKey: 'cat_hiburan', emoji: '🎉', color: '#ec4899' },
  { id: 'lainnya', labelKey: 'cat_lainnya', emoji: '📦', color: '#94a3b8' },
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
  { id: '7days', labelKey: 'd_7days' },
  { id: '30days', labelKey: 'd_30days' },
  { id: 'this_month', labelKey: 'd_this_month' },
  { id: 'last_month', labelKey: 'd_last_month' },
]

/**
 * Roles yang tersedia
 */
export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
}

/**
 * Mendapatkan info kategori berdasarkan label atau id
 */
export function getCategoryInfo(identifier) {
  return CATEGORIES.find(c => c.id === identifier || c.labelKey === identifier) || {
    id: 'lainnya',
    labelKey: 'cat_lainnya',
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
