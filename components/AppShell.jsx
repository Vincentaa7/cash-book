'use client'
// components/AppShell.jsx - Layout wrapper dengan Sidebar + Bottom Nav
// Semua halaman autentikasi dibungkus komponen ini

import { useState, useEffect, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, List, BarChart2,
  Settings, LogOut, Sun, Moon
} from 'lucide-react'
import { getInitials } from '@/lib/constants'

// Context untuk user session
export const UserContext = createContext(null)
export const useUser = () => useContext(UserContext)

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transaksi/baru', label: 'Catat Pengeluaran', icon: PlusCircle },
  { href: '/transaksi', label: 'Riwayat', icon: List },
  { href: '/laporan', label: 'Laporan', icon: BarChart2 },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, adminOnly: true },
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const [familyName, setFamilyName] = useState('Cash Book')

  // Ambil data user saat mount
  useEffect(() => {
    fetchUser()
    // Ambil tema dari localStorage
    const savedTheme = localStorage.getItem('cb-theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        window.location.href = '/login'
      }
    } catch {
      window.location.href = '/login'
    }
  }

  // Ambil nama keluarga dari settings
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.settings?.familyName) setFamilyName(d.settings.familyName) })
      .catch(() => {})
  }, [])

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('cb-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const visibleNavItems = NAV_ITEMS.filter(item =>
    !item.adminOnly || user?.role === 'admin'
  )

  if (!user) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <p>Memuat...</p>
      </div>
    )
  }

  return (
    <UserContext.Provider value={{ user, setUser, familyName, setFamilyName }}>
      <div className="app-layout">
        {/* Sidebar Desktop */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">💰</div>
              <div>
                <div className="sidebar-logo-text">{familyName}</div>
                <div className="sidebar-logo-sub">Buku Keuangan Digital</div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Menu Utama</div>
              {visibleNavItems.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href ||
                  (item.href !== '/transaksi/baru' && pathname.startsWith(item.href) && item.href !== '/dashboard') ||
                  (item.href === '/dashboard' && pathname === '/dashboard')
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                    <Icon size={18} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="sidebar-footer">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="nav-link"
              style={{ marginBottom: 4 }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>

            {/* User card */}
            <div className="user-card">
              <div
                className="user-avatar"
                style={{ backgroundColor: user.avatarColor || '#0d9488' }}
              >
                {getInitials(user.name)}
              </div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role === 'admin' ? 'Admin' : 'Anggota'}</div>
              </div>
              <button
                onClick={handleLogout}
                className="btn-icon"
                title="Keluar"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Mobile Header */}
          <header className="mobile-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                width: 32, height: 32, background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16
              }}>💰</div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{familyName}</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={toggleTheme} className="btn-icon">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button onClick={handleLogout} className="btn-icon">
                <LogOut size={18} />
              </button>
            </div>
          </header>

          {children}
        </main>

        {/* Bottom Nav Mobile */}
        <nav className="bottom-nav">
          <div className="bottom-nav-items">
            <Link href="/dashboard" className={`bottom-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>Beranda</span>
            </Link>
            <Link href="/transaksi" className={`bottom-nav-item ${pathname === '/transaksi' ? 'active' : ''}`}>
              <List size={20} />
              <span>Riwayat</span>
            </Link>
            <div className="bottom-nav-item-wrapper">
              <Link href="/transaksi/baru" className="bottom-nav-item add-btn">
                <PlusCircle size={24} />
              </Link>
            </div>
            <Link href="/laporan" className={`bottom-nav-item ${pathname === '/laporan' ? 'active' : ''}`}>
              <BarChart2 size={20} />
              <span>Laporan</span>
            </Link>
            <Link href="/pengaturan" className={`bottom-nav-item ${pathname === '/pengaturan' ? 'active' : ''}`}>
              <Settings size={20} />
              <span>Atur</span>
            </Link>
          </div>
        </nav>
      </div>
    </UserContext.Provider>
  )
}
