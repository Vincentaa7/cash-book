'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const UserContext = createContext(null)

export const useUser = () => {
  return useContext(UserContext)
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [familyName, setFamilyName] = useState('Cash Book')
  const router = useRouter()
  const pathname = usePathname()

  const fetchUser = useCallback(async () => {
    // Jika sedang di halaman login, tidak perlu memanggil /api/auth/me agar halaman login ringan & cepat
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        if (data.familyName) {
          setFamilyName(data.familyName)
        }
      } else {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          router.replace('/login')
        }
      }
    } catch {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    // Hanya fetch jika user belum terisi dan bukan di halaman /login
    if (!user && pathname && !pathname.startsWith('/login')) {
      fetchUser()
    } else if (pathname && pathname.startsWith('/login')) {
      setLoading(false)
    }
  }, [pathname, user, fetchUser])

  const loginSuccess = useCallback((userData, familyNameData) => {
    setUser(userData)
    if (familyNameData) {
      setFamilyName(familyNameData)
    }
    setLoading(false)
  }, [])

  return (
    <UserContext.Provider value={{ user, setUser, loading, familyName, setFamilyName, loginSuccess }}>
      {children}
    </UserContext.Provider>
  )
}
