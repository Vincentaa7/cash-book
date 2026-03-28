'use client'
// components/AppShell.jsx - Layout wrapper dengan Sidebar + Bottom Nav
// Semua halaman autentikasi dibungkus komponen ini

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, List, BarChart2,
  Settings, LogOut, Sun, Moon
} from 'lucide-react'
import { getInitials } from '@/lib/constants'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@/components/UserContext'

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/transaksi/baru', labelKey: 'add_expense', icon: PlusCircle },
  { href: '/transaksi', labelKey: 'history', icon: List },
  { href: '/laporan', labelKey: 'reports', icon: BarChart2 },
  { href: '/pengaturan', labelKey: 'settings', icon: Settings, adminOnly: true },
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const { t, language } = useLanguage()
  const { user, loading, familyName } = useUser()
  const [theme, setTheme] = useState('light')

  // Ambil tema dari localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('cb-theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
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

  if (loading || !user) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <p>{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">💰</div>
            <div>
              <div className="sidebar-logo-text">{familyName}</div>
              <div className="sidebar-logo-sub">{t('digital_cashbook')}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('system_menu')}</div>
            {visibleNavItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/transaksi/baru' && pathname.startsWith(item.href) && item.href !== '/dashboard') ||
                (item.href === '/dashboard' && pathname === '/dashboard')
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                  <Icon size={18} />
                  {t(item.labelKey)}
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
            {theme === 'light' ? t('dark_mode') : t('light_mode')}
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
              <div className="user-role">{user.role === 'admin' ? 'Admin' : 'Member'}</div>
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
            <span>{t('dashboard')}</span>
          </Link>
          <Link href="/transaksi" className={`bottom-nav-item ${pathname === '/transaksi' ? 'active' : ''}`}>
            <List size={20} />
            <span>{t('history')}</span>
          </Link>
          <div className="bottom-nav-item-wrapper">
            <Link href="/transaksi/baru" className="bottom-nav-item add-btn">
              <PlusCircle size={24} />
            </Link>
          </div>
          <Link href="/laporan" className={`bottom-nav-item ${pathname === '/laporan' ? 'active' : ''}`}>
            <BarChart2 size={20} />
            <span>{t('reports')}</span>
          </Link>
          <Link href="/pengaturan" className={`bottom-nav-item ${pathname === '/pengaturan' ? 'active' : ''}`}>
            <Settings size={20} />
            <span>{t('settings')}</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
