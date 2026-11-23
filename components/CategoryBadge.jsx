'use client'
// components/CategoryBadge.jsx - Badge kategori Clean Fintech dengan ikon vektor Lucide

import { getCategoryInfo } from '@/lib/constants'
import { useLanguage } from '@/components/LanguageContext'
import CategoryIcon from '@/components/CategoryIcon'

export default function CategoryBadge({ category, size = 'normal' }) {
  const { t } = useLanguage()
  const info = getCategoryInfo(category)
  const iconSize = size === 'xs' ? 11 : size === 'sm' ? 12 : 13

  const style = {
    backgroundColor: info.color + '16',
    borderColor: info.color + '30',
    color: info.color,
    fontSize: size === 'xs' ? '0.64rem' : (size === 'sm' ? '0.72rem' : '0.75rem'),
    padding: size === 'xs' ? '2px 7px' : (size === 'sm' ? '3px 8px' : '4px 10px'),
  }

  return (
    <span className="cat-badge" style={style}>
      <CategoryIcon category={info.id} size={iconSize} style={{ flexShrink: 0 }} />
      <span>{t(info.labelKey)}</span>
    </span>
  )
}
