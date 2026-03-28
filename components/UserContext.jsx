'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const UserContext = createContext(null)

export const useUser = () => {
  const context = useContext(UserContext)
  // We don't throw error here to allow components outside AppShell to handle null if needed,
  // but for translated pages, it's better to use useLanguage.
  return context
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [familyName, setFamilyName] = useState('Cash Book')
  const router = useRouter()

  useEffect(() => {
    fetchUser()
    fetchSettings()
  }, [])

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        // Only redirect if we are not on the login page
        if (window.location.pathname !== '/login') {
          router.push('/login')
        }
      }
    } catch {
      if (window.location.pathname !== '/login') {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings?.familyName) {
          setFamilyName(data.settings.familyName)
        }
      }
    } catch {}
  }

  return (
    <UserContext.Provider value={{ user, setUser, loading, familyName, setFamilyName }}>
      {children}
    </UserContext.Provider>
  )
}
