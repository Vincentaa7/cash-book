'use client'
// components/CategoryBadge.jsx - Badge kategori dengan emoji dan warna

import { getCategoryInfo } from '@/lib/constants'

export default function CategoryBadge({ category, size = 'normal' }) {
  const info = getCategoryInfo(category)

  const style = {
    backgroundColor: info.color + '20',
    color: info.color,
    fontSize: size === 'xs' ? '0.6rem' : (size === 'sm' ? '0.7rem' : '0.75rem'),
    padding: size === 'xs' ? '1px 6px' : (size === 'sm' ? '2px 8px' : '4px 10px'),
  }

  return (
    <span className="cat-badge" style={style}>
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </span>
  )
}
