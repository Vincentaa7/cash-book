'use client'
// components/ToastContext.jsx - Global Clean Fintech Toast Notification & In-App Confirm Dialog

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, Check } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const confirmResolverRef = useRef(null)

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(item => item.id !== id))
  }, [])

  const pushToast = useCallback((type, message, duration = 3400) => {
    if (!message) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev.slice(-3), { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: (msg, dur) => pushToast('success', msg, dur),
    error: (msg, dur) => pushToast('error', msg, dur || 4200),
    info: (msg, dur) => pushToast('info', msg, dur),
  }

  const confirmDialog = useCallback(({
    title = 'Konfirmasi',
    message = 'Apakah Anda yakin ingin melanjutkan?',
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal',
    variant = 'primary',
  } = {}) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve
      setConfirmState({ title, message, confirmText, cancelText, variant })
    })
  }, [])

  const handleConfirmResult = (result) => {
    setConfirmState(null)
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result)
      confirmResolverRef.current = null
    }
  }

  return (
    <ToastContext.Provider value={{ toast, confirmDialog }}>
      {children}

      {/* Floating Toast Stack */}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map(item => (
            <div key={item.id} className={`toast-item toast-${item.type}`}>
              <span className="toast-icon">
                {item.type === 'success' && <CheckCircle2 size={16} strokeWidth={2} />}
                {item.type === 'error' && <AlertCircle size={16} strokeWidth={2} />}
                {item.type === 'info' && <Info size={16} strokeWidth={2} />}
              </span>
              <span className="toast-message">{item.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(item.id)}
                aria-label="Tutup notifikasi"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global Clean Fintech Confirm Modal (Replaces window.confirm) */}
      {confirmState && (
        <div className="modal-overlay" onClick={() => handleConfirmResult(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {confirmState.variant === 'danger' ? (
                  <AlertTriangle size={17} style={{ color: 'var(--color-danger)' }} />
                ) : (
                  <Info size={17} style={{ color: 'var(--color-primary-500)' }} />
                )}
                {confirmState.title}
              </h3>
              <button type="button" className="btn-icon" onClick={() => handleConfirmResult(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                {confirmState.message}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => handleConfirmResult(false)}>
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${confirmState.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleConfirmResult(true)}
                autoFocus
              >
                <Check size={15} /> {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
