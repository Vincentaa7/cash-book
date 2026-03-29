'use client'
// app/login/page.jsx - Halaman Login

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageContext'

export default function LoginPage() {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)

  // Apply theme dari localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('cb-theme') || 'light'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('required_field'))
      return
    }
    if (!pin) {
      setError(t('required_field'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin }),
      })

      const data = await res.json()

      if (res.ok) {
        window.location.href = '/dashboard'
      } else {
        setError(data.error || t('connection_error'))
      }
    } catch {
      setError(t('connection_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">💰</div>
          <h1 className="login-title">Cash Book</h1>
          <p className="login-subtitle">{t('digital_cashbook')}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form login */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-name">
              {t('member_name')}
            </label>
            <input
              id="login-name"
              type="text"
              className="form-input"
              placeholder="Masukkan nama anggota"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-pin">
              Password Login
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-pin"
                type={showPin ? 'text' : 'password'}
                className="form-input"
                placeholder="Masukkan password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                {showPin ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                {t('loading')}
              </>
            ) : (
              <> Masuk</>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {t('digital_cashbook')}
        </p>
      </div>
    </div>
  )
}
