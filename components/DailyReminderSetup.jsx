'use client'
// components/DailyReminderSetup.jsx — Komponen pengaturan notifikasi pengingat harian

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { Bell, BellOff, CheckCircle, XCircle, Play } from 'lucide-react'

const STORAGE_KEY_ENABLED = 'cashbook_reminder_enabled'
const STORAGE_KEY_TIME = 'cashbook_reminder_time'
const DEFAULT_TIME = '21:00'

export default function DailyReminderSetup({ familyName = 'Cash Book' }) {
  const { t } = useLanguage()
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState(DEFAULT_TIME)
  const [permissionStatus, setPermissionStatus] = useState('default') // 'default' | 'granted' | 'denied'
  const [swRegistered, setSwRegistered] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null) // { type: 'success'|'error', text: string }
  const [supported, setSupported] = useState(true)

  // Load saved state dari localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setSupported(false)
      return
    }

    const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'
    const savedTime = localStorage.getItem(STORAGE_KEY_TIME) || DEFAULT_TIME
    setEnabled(savedEnabled)
    setTime(savedTime)
    setPermissionStatus(Notification.permission)

    // Register Service Worker
    registerSW().then(registered => {
      setSwRegistered(registered)
      // Jika sudah enabled + permission granted, aktifkan jadwal
      if (savedEnabled && Notification.permission === 'granted' && registered) {
        sendSwMessage({ type: 'SCHEDULE_REMINDER', payload: { time: savedTime, familyName } })
      }
    })
  }, [familyName])

  async function registerSW() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      return !!reg
    } catch (err) {
      console.error('SW registration failed:', err)
      return false
    }
  }

  function sendSwMessage(msg) {
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage(msg)
    })
  }

  async function handleToggle() {
    if (!supported) return

    if (!enabled) {
      // Minta izin notifikasi
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)

      if (permission !== 'granted') {
        showStatus('error', t('reminder_permission_denied'))
        return
      }

      if (!swRegistered) {
        const ok = await registerSW()
        setSwRegistered(ok)
        if (!ok) {
          showStatus('error', t('reminder_sw_error'))
          return
        }
      }

      setEnabled(true)
      localStorage.setItem(STORAGE_KEY_ENABLED, 'true')
      localStorage.setItem(STORAGE_KEY_TIME, time)
      sendSwMessage({ type: 'SCHEDULE_REMINDER', payload: { time, familyName } })
      showStatus('success', t('reminder_saved'))
    } else {
      // Nonaktifkan
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY_ENABLED, 'false')
      sendSwMessage({ type: 'CANCEL_REMINDER' })
      showStatus('success', `${t('reminder_title')} dinonaktifkan.`)
    }
  }

  function handleTimeChange(e) {
    const newTime = e.target.value
    setTime(newTime)
    localStorage.setItem(STORAGE_KEY_TIME, newTime)
    if (enabled) {
      sendSwMessage({ type: 'SCHEDULE_REMINDER', payload: { time: newTime, familyName } })
    }
  }

  async function handleTest() {
    if (!supported) return

    const permission = permissionStatus === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

    setPermissionStatus(permission)

    if (permission !== 'granted') {
      showStatus('error', t('reminder_permission_denied'))
      return
    }

    if (!swRegistered) {
      const ok = await registerSW()
      setSwRegistered(ok)
    }

    sendSwMessage({ type: 'TEST_NOTIFICATION', payload: { familyName } })
    showStatus('success', 'Notifikasi percobaan dikirim!')
  }

  function showStatus(type, text) {
    setStatusMsg({ type, text })
    setTimeout(() => setStatusMsg(null), 4000)
  }

  if (!supported) {
    return (
      <div className="alert alert-warning" style={{ marginTop: 16 }}>
        <XCircle size={16} />
        <span>{t('reminder_not_supported')}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Status notifikasi browser */}
      {permissionStatus === 'denied' && (
        <div className="alert alert-danger">
          <XCircle size={16} />
          <span>{t('reminder_permission_denied')}</span>
        </div>
      )}
      {permissionStatus === 'granted' && enabled && (
        <div className="alert alert-success">
          <CheckCircle size={16} />
          <span>{t('reminder_permission_granted')} — Pengingat aktif pukul <strong>{time}</strong></span>
        </div>
      )}

      {/* Toggle Enable / Disable */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderRadius: 12,
        border: `2px solid ${enabled ? 'var(--color-primary-600)' : 'var(--border-color)'}`,
        background: enabled ? 'var(--color-primary-50, rgba(13,148,136,0.06))' : 'var(--bg-secondary)',
        transition: 'all 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: enabled ? 'var(--color-primary-600)' : 'var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', transition: 'background 0.2s',
          }}>
            {enabled ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('reminder_enable')}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {t('reminder_subtitle')}
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          style={{
            position: 'relative',
            width: 52, height: 28,
            borderRadius: 14,
            background: enabled ? 'var(--color-primary-600)' : 'var(--border-color)',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3, left: enabled ? 27 : 3,
            width: 22, height: 22,
            borderRadius: '50%', background: 'white',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Jam Pengingat */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('reminder_time')}</label>
        <input
          type="time"
          className="form-input"
          value={time}
          onChange={handleTimeChange}
          style={{ maxWidth: 160 }}
        />
      </div>

      {/* Tombol Test */}
      <div>
        <button className="btn btn-secondary" onClick={handleTest} style={{ gap: 8 }}>
          <Play size={15} />
          {t('reminder_test')}
        </button>
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  )
}
