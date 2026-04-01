'use client'
// components/CarryOverModal.jsx - Popup Global Pindahan Saldo
// Desain Premium Baru (Sesuai Permintaan: Menghilangkan Efek RGB)

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { formatRupiah, getMonthName } from '@/lib/format'
import { TrendingUp, X, Check, Wallet } from 'lucide-react'

export default function CarryOverModal({ amount, prevMonth, prevYear, onComplete, onSnooze }) {
  const { t, language } = useLanguage()
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  async function handleAction(action) {
    if (action === 'snooze') {
      onSnooze()
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/budget/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, action })
      })
      if (res.ok) {
        onComplete(true) // Diproses (setuju atau tolak permanen)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!isVisible && !loading) return null

  const monthName = getMonthName(prevMonth, language)
  const formattedAmount = formatRupiah(amount)
  
  const msg = t('transfer_msg')
    .replace('{amount}', formattedAmount)
    .replace('{month}', monthName)

  return (
    <div className={`modal-overlay ${isVisible ? 'active' : ''}`} style={{ zIndex: 1000 }}>
      {/* Modal Edition: Bersih, Putih, Tanpa RGB Running */}
      <div className="modal modal-premium" style={{ width: '90%', maxWidth: 420 }}>
        <div style={{ padding: '28px 32px' }}>
          
          {/* Close Button X */}
          <button 
            onClick={() => handleAction('snooze')} 
            className="btn-icon" 
            style={{ position: 'absolute', top: 16, right: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.03)' }}
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ 
              width: 44, height: 44, 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, #10b981, #3b82f6)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' 
            }}>
              <TrendingUp size={24} color="white" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {t('prev_month_surplus')}
            </h3>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, marginBottom: 24 }}>
              {msg}
            </p>
            <div style={{ 
              background: '#f8fafc', 
              padding: '18px', 
              borderRadius: 16, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                width: 42, height: 42, borderRadius: 10, background: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0'
              }}>
                <Wallet size={22} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
                  {t('balance')} {monthName}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  {formattedAmount}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', gap: 14 }}>
            <button 
              className="btn" 
              style={{ 
                flex: 1, height: 48, borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600
              }} 
              onClick={() => handleAction('reject')}
              disabled={loading}
            >
              {t('reject')}
            </button>
            <button 
              className="btn btn-primary" 
              style={{ 
                flex: 1.5, height: 48, borderRadius: 12, gap: 8, background: '#10b981', border: 'none', fontWeight: 700
              }} 
              onClick={() => handleAction('agree')}
              disabled={loading}
            >
              {loading ? <div className="spinner-sm" /> : <Check size={20} />}
              {t('agree')}
            </button>
          </div>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
          }
          .modal-overlay.active {
            opacity: 1;
            pointer-events: auto;
          }
          .modal {
            transform: scale(0.9);
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .modal-overlay.active .modal {
            transform: scale(1);
          }
          .spinner-sm {
            width: 18px; height: 18px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
