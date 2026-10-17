'use client'
// app/login/page.jsx - Multi-Family Cash Book Login (21st.dev Fintech Glass Aesthetic)

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  UserPlus,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@/components/UserContext'
import SpaceLogin, { GlassInput } from '@/components/ui/space-login'

export default function LoginPage() {
  const router = useRouter()
  const { t, language, changeLanguage } = useLanguage()
  const userCtx = useUser()

  // Prefetch halaman dashboard agar transisi setelah login instan tanpa jeda
  useEffect(() => {
    router.prefetch('/dashboard')
  }, [router])

  // Active mode: 'login' | 'join' | 'register'
  const [activeTab, setActiveTab] = useState('login')

  // Shared UI states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showPassword, setShowPassword] = useState(false)

  // Tab 1: Login state
  const [loginName, setLoginName] = useState('')
  const [loginPin, setLoginPin] = useState('')

  // Tab 2: Join via Family Invite Code + Username/Nickname + Password/PIN
  const [inviteCode, setInviteCode] = useState('')
  const [joinNickname, setJoinNickname] = useState('')
  const [joinPin, setJoinPin] = useState('')

  // Tab 3: Create New Family Cash Book (Superadmin + Email OTP)
  const [regStep, setRegStep] = useState('form') // 'form' | 'otp'
  const [familyName, setFamilyName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [devOtp, setDevOtp] = useState(null)

  function switchTab(tab) {
    setActiveTab(tab)
    setError('')
    setSuccessMsg('')
    setSuggestions([])
    setShowPassword(false)
  }

  function applySuggestion(suggestedUsername) {
    if (activeTab === 'register') {
      setRegUsername(suggestedUsername)
    } else if (activeTab === 'join') {
      setJoinNickname(suggestedUsername)
    }
    setSuggestions([])
    setError('')
  }

  function completeLoginRedirect(data) {
    if (userCtx?.loginSuccess && data?.user) {
      userCtx.loginSuccess(data.user, data.familyName)
    }
    router.replace('/dashboard')
  }

  // --- Handler Tab 1: Login ---
  async function handleLoginSubmit(e) {
    e.preventDefault()
    setError('')
    setSuggestions([])

    if (!loginName.trim() || !loginPin) {
      setError(t('required_field'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName.trim(), pin: loginPin }),
      })
      const data = await res.json()

      if (res.ok) {
        completeLoginRedirect(data)
      } else {
        setError(data.error || t('connection_error'))
        setLoading(false)
      }
    } catch {
      setError(t('connection_error'))
      setLoading(false)
    }
  }

  // --- Handler Tab 2: Join / Login with Family Invite Code + Username + Password/PIN ---
  async function handleJoinSubmit(e) {
    e.preventDefault()
    setError('')
    setSuggestions([])

    if (!inviteCode.trim() || !joinNickname.trim() || !joinPin) {
      setError(t('required_field'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/join-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          memberName: joinNickname.trim(),
          pin: joinPin,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        completeLoginRedirect(data)
      } else {
        setError(data.error || t('connection_error'))
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions)
        }
        setLoading(false)
      }
    } catch {
      setError(t('connection_error'))
      setLoading(false)
    }
  }

  // --- Handler Tab 3 (Step 1): Request Email OTP ---
  async function handleRequestOtp(e) {
    if (e) e.preventDefault()
    setError('')
    setSuccessMsg('')
    setSuggestions([])

    if (!familyName.trim() || !regEmail.trim() || !regPassword) {
      setError(t('required_field'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_otp',
          familyName: familyName.trim(),
          email: regEmail.trim(),
          pin: regPassword,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setRegStep('otp')
        setSuccessMsg(data.message || '')
        if (data.devOtp || data.devOtpPreview) {
          setDevOtp(data.devOtp || data.devOtpPreview)
        } else {
          setDevOtp(null)
        }
      } else {
        setError(data.error || t('connection_error'))
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions)
        }
      }
    } catch {
      setError(t('connection_error'))
    } finally {
      setLoading(false)
    }
  }

  // --- Handler Tab 3 (Step 2): Verify OTP & Create Family ---
  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError(t('required_field'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: regEmail.trim(),
          otp: otpCode.trim(),
        }),
      })
      const data = await res.json()

      if (res.ok) {
        completeLoginRedirect(data)
      } else {
        setError(data.error || t('connection_error'))
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setRegStep('form')
          setSuggestions(data.suggestions)
        }
        setLoading(false)
      }
    } catch {
      setError(t('connection_error'))
      setLoading(false)
    }
  }

  // Primary CTA button style (explicit inline + Tailwind for guaranteed contrast)
  const primaryBtnStyle = {
    background: 'linear-gradient(135deg, #10b981 0%, #0d9488 55%, #0f766e 100%)',
    border: '1px solid rgba(110, 231, 183, 0.4)',
    color: '#ffffff',
    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
  }

  // Language switcher in top right corner
  const languageSwitcher = (
    <div
      style={{
        background: 'rgba(6, 22, 19, 0.82)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(52, 211, 153, 0.28)',
        borderRadius: '14px',
        padding: '4px',
      }}
      className="flex items-center gap-1 shadow-lg"
    >
      {[
        { code: 'id', label: '🇮🇩 ID' },
        { code: 'en', label: '🇺🇸 EN' },
        { code: 'nl', label: '🇳🇱 NL' },
      ].map(lang => {
        const isActive = language === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => changeLanguage(lang.code)}
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)'
                : 'transparent',
              color: isActive ? '#ffffff' : '#cbd5e1',
              border: isActive
                ? '1px solid rgba(167, 243, 208, 0.4)'
                : '1px solid transparent',
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:text-white"
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <SpaceLogin
      title=""
      topRightElement={languageSwitcher}
      customContent={
        <div
          style={{
            background: 'rgba(6, 20, 18, 0.78)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            border: '1px solid rgba(52, 211, 153, 0.24)',
            boxShadow:
              '0 24px 64px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
          className="w-full rounded-3xl p-6 sm:p-7"
        >
          {/* Header Brand */}
          <div className="flex flex-col items-center mb-5">
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(13, 148, 136, 0.15))',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)',
              }}
              className="w-13 h-13 p-3 rounded-2xl flex items-center justify-center mb-3"
            >
              <Wallet className="w-6 h-6 text-emerald-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center">
              Cash Book
            </h1>
            <p className="text-emerald-200/70 text-xs sm:text-sm mt-1 text-center font-medium">
              {t('digital_cashbook')} • {t('system_version')}
            </p>
          </div>

          {/* 3-Tab Navigation */}
          <div
            style={{
              background: 'rgba(2, 10, 9, 0.75)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
            }}
            className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl mb-4"
          >
            {[
              { id: 'login', icon: LogIn, label: t('auth_tab_login') },
              { id: 'join', icon: KeyRound, label: t('auth_tab_join') },
              { id: 'register', icon: UserPlus, label: t('auth_tab_register') },
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)'
                      : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    border: isActive
                      ? '1px solid rgba(167, 243, 208, 0.45)'
                      : '1px solid transparent',
                    boxShadow: isActive ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:text-white"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Contextual Hint Box */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
            }}
            className="mb-4 px-3.5 py-2.5 rounded-xl text-slate-200 text-xs leading-relaxed flex items-start gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {activeTab === 'login' && t('auth_login_hint')}
              {activeTab === 'join' && t('auth_join_hint')}
              {activeTab === 'register' && t('auth_register_hint')}
            </span>
          </div>

          {/* Error & Suggestion Alert */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.16)',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                }}
                className="mb-4 p-3.5 rounded-xl text-red-100 text-xs flex flex-col gap-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>

                {/* Clickable Username Suggestions when duplicate username detected */}
                {suggestions.length > 0 && (
                  <div className="pt-2 border-t border-red-400/25">
                    <p className="text-[11px] text-slate-200 mb-1.5 font-semibold">
                      {t('auth_suggestions_title')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => applySuggestion(sug)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.25)',
                            border: '1px solid rgba(52, 211, 153, 0.5)',
                            color: '#ffffff',
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer hover:scale-105"
                        >
                          @{sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {successMsg && !error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.18)',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                }}
                className="mb-4 p-3 rounded-xl text-emerald-100 text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TAB 1: MASUK (EXISTING ACCOUNT / REGISTERED BY SUPERADMIN) */}
          {activeTab === 'login' && (
            <motion.form
              key="tab-login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_username_label')}
                </label>
                <GlassInput
                  id="login-name"
                  type="text"
                  placeholder={t('auth_username_placeholder')}
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_password_label')}
                </label>
                <GlassInput
                  id="login-pin"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth_password_placeholder')}
                  value={loginPin}
                  onChange={e => setLoginPin(e.target.value)}
                  autoComplete="current-password"
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8' }}
                      className="hover:text-white transition-colors p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div className="pt-1">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  style={primaryBtnStyle}
                  className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{t('auth_btn_login')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* TAB 2: MASUK / GABUNG DENGAN KODE KHUSUS KELUARGA + USERNAME + PASSWORD/PIN */}
          {activeTab === 'join' && (
            <motion.form
              key="tab-join"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleJoinSubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_invite_code_label')}
                </label>
                <GlassInput
                  type="text"
                  placeholder={t('auth_invite_code_placeholder')}
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest uppercase text-center font-bold text-base"
                  required
                  rightElement={<KeyRound className="w-4 h-4 text-emerald-400 mr-1" />}
                />
              </div>

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_nickname_label')}
                </label>
                <GlassInput
                  type="text"
                  placeholder={t('auth_nickname_placeholder')}
                  value={joinNickname}
                  onChange={e => setJoinNickname(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_password_label')}
                </label>
                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth_password_placeholder')}
                  value={joinPin}
                  onChange={e => setJoinPin(e.target.value)}
                  autoComplete="new-password"
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8' }}
                      className="hover:text-white transition-colors p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  style={primaryBtnStyle}
                  className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>{t('auth_btn_join')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* TAB 3: BUAT CASH BOOK BARU (SUPERADMIN + EMAIL OTP VERIFICATION) */}
          {activeTab === 'register' && regStep === 'form' && (
            <motion.form
              key="tab-register-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRequestOtp}
              className="space-y-3"
            >
              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1 ml-1">
                  {t('auth_family_name_label')}
                </label>
                <GlassInput
                  type="text"
                  placeholder={t('auth_family_name_placeholder')}
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1 ml-1">
                  {t('auth_email_label')}
                </label>
                <GlassInput
                  type="email"
                  placeholder={t('auth_email_placeholder')}
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  autoComplete="email"
                  required
                  rightElement={<Mail className="w-4 h-4 text-emerald-300/60 mr-1" />}
                />
              </div>

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1 ml-1">
                  {t('auth_password_label')}
                </label>
                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth_password_placeholder')}
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8' }}
                      className="hover:text-white transition-colors p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  style={primaryBtnStyle}
                  className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{t('auth_btn_send_otp')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* TAB 3 (STEP 2): 6-DIGIT EMAIL OTP VERIFICATION */}
          {activeTab === 'register' && regStep === 'otp' && (
            <motion.form
              key="tab-register-otp"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerifyOtp}
              className="space-y-4"
            >
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                }}
                className="p-3.5 rounded-xl text-white text-xs space-y-1.5"
              >
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('auth_otp_title')}</span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {t('auth_otp_subtitle').replace('{email}', regEmail)}
                </p>
              </div>

              {devOtp && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.18)',
                    border: '1px solid rgba(251, 191, 36, 0.45)',
                  }}
                  className="p-3 rounded-xl text-amber-100 text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="block text-[11px] text-amber-200">{t('auth_dev_otp_banner')}</span>
                    <span className="font-mono font-bold text-base tracking-widest text-white">{devOtp}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtp)}
                    style={{
                      background: 'rgba(245, 158, 11, 0.35)',
                      border: '1px solid rgba(252, 211, 77, 0.5)',
                      color: '#ffffff',
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 hover:brightness-110"
                  >
                    Pakai OTP
                  </button>
                </div>
              )}

              <div>
                <label className="block text-slate-200 text-xs font-semibold mb-1.5 ml-1">
                  {t('auth_otp_label')}
                </label>
                <GlassInput
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('auth_otp_placeholder')}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="text-center font-mono text-lg tracking-[0.4em] font-bold"
                  required
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  style={primaryBtnStyle}
                  className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t('auth_btn_verify_create')}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep('form')
                      setError('')
                      setSuccessMsg('')
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#cbd5e1' }}
                    className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('auth_btn_back_form')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleRequestOtp}
                    style={{ background: 'transparent', border: 'none', color: '#34d399' }}
                    className="flex items-center gap-1.5 text-xs font-semibold hover:text-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('auth_btn_resend_otp')}</span>
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </div>
      }
    />
  )
}
