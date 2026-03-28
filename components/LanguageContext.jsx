'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import translations from '@/lib/translations'

const LanguageContext = createContext(null)

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('id')

  useEffect(() => {
    const savedLang = localStorage.getItem('cb-lang') || 'id'
    setLanguage(savedLang)
  }, [])

  const t = (key) => {
    return translations[language]?.[key] || key
  }

  const changeLanguage = (lang) => {
    setLanguage(lang)
    localStorage.setItem('cb-lang', lang)
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
