'use client'
// components/AppShell.jsx - Clean Fintech Layout Wrapper (Sidebar + Mobile Nav + Skeleton Boot)

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, Plus, List, BarChart2,
  Settings, LogOut, Sun, Moon, Calendar, BookOpen, Wallet
} from 'lucide-react'
import { getInitials } from '@/lib/constants'
import { formatMemberName } from '@/lib/format'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@/components/UserContext'
import CarryOverModal from '@/components/CarryOverModal'
import AiChatWidget from '@/components/AiChatWidget'
import { AppShellSkeleton } from '@/components/Skeleton'
import { prefetchApiCache, invalidateCache } from '@/lib/clientCache'

const NAV_ITEMS = [
  { href: '/dashboard',      labelKey: 'dashboard',       icon: LayoutDashboard },
  { href: '/transaksi/baru', labelKey: 'add_expense',     icon: PlusCircle },
  { href: '/transaksi',      labelKey: 'history',         icon: List },
  { href: '/laporan',        labelKey: 'reports',         icon: BarChart2 },
  { href: '/kalender',       labelKey: 'calendar',        icon: Calendar },
  { href: '/pribadi',        labelKey: 'personal_ledger', icon: BookOpen },
  { href: '/pengaturan',     labelKey: 'settings',        icon: Settings },
]

// Cache di memori modul agar pindah antar-menu tidak menembak ulang API check-carryover setiap klik
let lastCarryOverCheckKey = null
let cachedCarryOverResult = null

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const { user, loading, familyName } = useUser()
  const [theme, setTheme] = useState('light')
  const [carryOverData, setCarryOverData] = useState(cachedCarryOverResult)
  const [isSnoozed, setIsSnoozed] = useState(false)

  useEffect(() => {
    if (!user) return
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()

    NAV_ITEMS.forEach(item => {
      try { router.prefetch(item.href) } catch {}
    })

    prefetchApiCache([
      `/api/dashboard?month=${m}&year=${y}&summaryOnly=true`,
      '/api/transactions?page=1&limit=15&sortBy=transactionDate&sortOrder=desc',
      '/api/members',
    ])
  }, [user, router])

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      const now = new Date()
      const checkKey = `${user.familyId || '1'}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      if (lastCarryOverCheckKey !== checkKey) {
        checkCarryOver(checkKey)
      }

      let midnightTimer = null
      const scheduleNextMidnight = () => {
        const current = new Date()
        const nextMidnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 0, 0, 1)
        const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - current.getTime())
        midnightTimer = setTimeout(() => {
          checkCarryOver()
          scheduleNextMidnight()
        }, msUntilMidnight)
      }
      scheduleNextMidnight()

      return () => {
        if (midnightTimer) clearTimeout(midnightTimer)
      }
    }
  }, [user])

  async function checkCarryOver(checkKey) {
    try {
      const now = new Date()
      const localMonth = now.getMonth() + 1
      const localYear = now.getFullYear()
      const res = await fetch(`/api/budget/check-carryover?month=${localMonth}&year=${localYear}`)
      const data = await res.json()
      if (checkKey) lastCarryOverCheckKey = checkKey
      if (data.hasCarryover) {
        cachedCarryOverResult = data
        setCarryOverData(data)
      } else {
        cachedCarryOverResult = null
        setCarryOverData(null)
      }
    } catch {}
  }

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
    lastCarryOverCheckKey = null
    cachedCarryOverResult = null
    invalidateCache()
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  if (loading || !user) {
    return <AppShellSkeleton />
  }

  return (
    <div className="app-layout">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Wallet size={18} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-logo-text truncate">{familyName}</div>
              <div className="sidebar-logo-sub">Cash Book · {t('system_version')}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('system_menu')}</div>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/transaksi/baru' && pathname.startsWith(item.href) && item.href !== '/dashboard') ||
                (item.href === '/dashboard' && pathname === '/dashboard')
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                  <Icon size={17} strokeWidth={1.85} />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={toggleTheme}
            className="nav-link"
            style={{ marginBottom: 8 }}
          >
            {theme === 'light' ? <Moon size={17} strokeWidth={1.85} /> : <Sun size={17} strokeWidth={1.85} />}
            {theme === 'light' ? t('dark_mode') : t('light_mode')}
          </button>

          <div className="user-card">
            <div
              className="user-avatar"
              style={{ backgroundColor: user.avatarColor || '#0d9488' }}
            >
              {getInitials(user.name)}
            </div>
            <div className="user-info">
              <div className="user-name" title={user.name}>{formatMemberName(user.name)}</div>
              <div className="user-role">
                {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Member'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon"
              title={t('logout')}
            >
              <LogOut size={15} strokeWidth={1.85} />
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
              width: 32, height: 32, background: 'var(--color-primary-600)',
              borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              boxShadow: '0 2px 8px -2px rgba(13, 148, 136, 0.45)',
            }}>
              <Wallet size={16} strokeWidth={2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: '1.2', letterSpacing: '-0.015em' }}>{familyName}</span>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Cash Book · {t('system_version')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link
              href="/kalender"
              className="btn-icon"
              title={t('calendar')}
              style={pathname.startsWith('/kalender') ? { color: 'var(--color-primary-500)', background: 'var(--color-primary-hover)' } : {}}
            >
              <Calendar size={17} strokeWidth={1.85} />
            </Link>
            <Link
              href="/pribadi"
              className="btn-icon"
              title={t('personal_ledger')}
              style={pathname.startsWith('/pribadi') ? { color: 'var(--color-primary-500)', background: 'var(--color-primary-hover)' } : {}}
            >
              <BookOpen size={17} strokeWidth={1.85} />
            </Link>
            <button type="button" onClick={toggleTheme} className="btn-icon" title={theme === 'light' ? t('dark_mode') : t('light_mode')}>
              {theme === 'light' ? <Moon size={17} strokeWidth={1.85} /> : <Sun size={17} strokeWidth={1.85} />}
            </button>
            <button type="button" onClick={handleLogout} className="btn-icon" title={t('logout')}>
              <LogOut size={17} strokeWidth={1.85} />
            </button>
          </div>
        </header>

        {/* Global Reminder Banner (Dashboard Only) */}
        {pathname === '/dashboard' && isSnoozed && carryOverData && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="reminder-banner" onClick={() => setIsSnoozed(false)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-success)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <PlusCircle size={18} strokeWidth={1.9} />
                </div>
                <div>
                  <div style={{ fontWeight: 650, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{t('carryover_reminder')}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('click_to_process')}</div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm">
                {t('process_now')}
              </button>
            </div>
          </div>
        )}

        {children}
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          <Link href="/dashboard" className={`bottom-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={19} strokeWidth={1.85} />
            <span>{t('dashboard')}</span>
          </Link>
          <Link href="/transaksi" className={`bottom-nav-item ${pathname === '/transaksi' ? 'active' : ''}`}>
            <List size={19} strokeWidth={1.85} />
            <span>{t('history')}</span>
          </Link>
          <div className="bottom-nav-item-wrapper">
            <Link href="/transaksi/baru" className="bottom-nav-item add-btn" aria-label={t('add_expense')}>
              <Plus size={22} strokeWidth={2.4} />
            </Link>
          </div>
          <Link href="/laporan" className={`bottom-nav-item ${pathname === '/laporan' ? 'active' : ''}`}>
            <BarChart2 size={19} strokeWidth={1.85} />
            <span>{t('reports')}</span>
          </Link>
          <Link href="/pengaturan" className={`bottom-nav-item ${pathname === '/pengaturan' ? 'active' : ''}`}>
            <Settings size={19} strokeWidth={1.85} />
            <span>{t('settings')}</span>
          </Link>
        </div>
      </nav>

      {/* Modal Pindahan Saldo */}
      {carryOverData && !isSnoozed && (
        <CarryOverModal
          amount={carryOverData.amount}
          prevMonth={carryOverData.prevMonth}
          prevYear={carryOverData.prevYear}
          onSnooze={() => setIsSnoozed(true)}
          onComplete={(success) => {
            setCarryOverData(null)
            setIsSnoozed(false)
            if (success) {
              window.location.reload()
            }
          }}
        />
      )}

      {/* AI Assistant Floating Chat Widget */}
      <AiChatWidget />
    </div>
  )
}
