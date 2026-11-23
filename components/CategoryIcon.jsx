'use client'
// components/CategoryIcon.jsx - Ikon vektor Lucide seragam untuk seluruh kategori (pengganti emoji)

import {
  ShoppingBasket,
  HeartPulse,
  Zap,
  Utensils,
  Shirt,
  Wrench,
  Package,
  ArrowDownLeft,
  Sparkles,
  GraduationCap,
  Car,
  ShoppingBag,
  Gamepad2,
  PiggyBank,
  Wallet,
  TrendingUp,
  Lightbulb,
} from 'lucide-react'

const ICON_MAP = {
  // Kategori Kas Keluarga
  sembako: ShoppingBasket,
  kesehatan: HeartPulse,
  tagihan: Zap,
  makan: Utensils,
  pakaian: Shirt,
  rumah: Wrench,
  lainnya: Package,
  pemasukan: ArrowDownLeft,
  kebersihan: Sparkles,
  pendidikan: GraduationCap,
  hiburan: Gamepad2,
  // Kategori Kas Pribadi
  makanan: Utensils,
  transport: Car,
  belanja: ShoppingBag,
  tabungan: PiggyBank,
  gaji: Wallet,
  investasi: TrendingUp,
  utilitas: Lightbulb,
  lainnya_prb: Package,
}

export default function CategoryIcon({ category, size = 14, strokeWidth = 1.85, className = '', style = {} }) {
  const Icon = ICON_MAP[category] || Package
  return <Icon size={size} strokeWidth={strokeWidth} className={className} style={{ flexShrink: 0, ...style }} />
}
