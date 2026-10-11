'use client'

import { useEffect, useState } from 'react'

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 1. Cek mode standalone (sudah terinstal)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsStandalone(true)
      return
    }

    // 2. Daftarkan Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          // SW registered successfully
        })
        .catch((err) => {
          console.error('PWA SW registration failed:', err)
        })
    }

    // 3. Tangkap event beforeinstallprompt untuk Android Chrome & desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Cek apakah user sudah menutup banner sebelumnya
      const dismissed = sessionStorage.getItem('pwa-dismissed')
      if (!dismissed) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Cek ketika app berhasil diinstal
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  if (isStandalone || !showInstallBanner) return null

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <img src="/icon-192.png" alt="Cash Book" width={38} height={38} style={{ borderRadius: 10 }} />
        </div>
        <div className="pwa-install-text">
          <div className="pwa-install-title">Install Aplikasi Cash Book</div>
          <div className="pwa-install-sub">Akses lebih cepat & praktis dari layar utama ponsel Anda</div>
        </div>
      </div>
      <div className="pwa-install-actions">
        <button className="pwa-btn-install" onClick={handleInstallClick}>
          Install
        </button>
        <button className="pwa-btn-dismiss" onClick={handleDismiss} aria-label="Tutup">
          ✕
        </button>
      </div>
    </div>
  )
}
