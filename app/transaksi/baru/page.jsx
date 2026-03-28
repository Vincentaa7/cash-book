'use client'
// app/transaksi/baru/page.jsx - Form Input Pengeluaran Baru

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useUser } from '@/components/UserContext'
import { useLanguage } from '@/components/LanguageContext'
import { CATEGORIES } from '@/lib/constants'
import { formatRupiah, formatNumber, formatDateInput } from '@/lib/format'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewTransactionPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { user } = useUser()

  const now = new Date()
  const [form, setForm] = useState({
    itemName: '',
    amount: '',
    category: '',
    transactionDate: formatDateInput(now),
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [budget, setBudget] = useState(null)
  const [totalExpense, setTotalExpense] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  // Ambil info budget bulan ini
  useEffect(() => {
    async function fetchBudget() {
      try {
        const [budgetRes, dashRes] = await Promise.all([
          fetch(`/api/budget?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
          fetch(`/api/dashboard?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
        ])
        const budgetData = await budgetRes.json()
        const dashData = await dashRes.json()
        setBudget(budgetData.budget)
        setTotalExpense(dashData.summary?.totalExpense || 0)
      } catch {}
    }
    fetchBudget()
  }, [])

  function handleAmountChange(e) {
    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
    setForm(prev => ({ ...prev, amount: raw }))
    if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }))
  }

  function validate() {
    const newErrors = {}
    if (!form.itemName.trim()) newErrors.itemName = t('required_field')
    if (!form.amount || parseInt(form.amount) <= 0) newErrors.amount = t('required_field')
    if (!form.category) newErrors.category = t('required_field')
    if (!form.transactionDate) newErrors.transactionDate = t('required_field')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmitClick(e) {
    e.preventDefault()
    if (!validate()) return
    setShowConfirm(true)
  }

  async function handleConfirm() {
    setShowConfirm(false)
    setLoading(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseInt(form.amount),
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/transaksi')
        }, 1800)
      } else {
        const data = await res.json()
        setErrors({ submit: data.error || t('connection_error') })
      }
    } catch {
      setErrors({ submit: t('connection_error') })
    } finally {
      setLoading(false)
    }
  }

  const remaining = budget ? (budget.amount - totalExpense) : null
  const amountNum = parseInt(form.amount || '0')
  const willExceed = remaining !== null && amountNum > remaining

  if (success) {
    return (
      <AppShell>
        <div className="page-container">
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>{t('save')} {t('reports')}!</h2>
            <p style={{ color: 'var(--text-muted)' }}>{t('digital_cashbook')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/transaksi" className="btn-icon">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1>{t('add_expense')} 📝</h1>
              <p>{t('digital_cashbook')}</p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Info sisa kas */}
          {budget && (
            <div className={`alert ${remaining <= 0 ? 'alert-danger' : remaining / budget.amount < 0.2 ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: 20 }}>
              <span>💰</span>
              <span>
                {t('total_expense')}: <strong>{formatRupiah(remaining)}</strong>
                {remaining <= 0 && ` — ${t('no_transactions')}`}
              </span>
            </div>
          )}

          {errors.submit && (
            <div className="alert alert-danger">
              <AlertCircle size={16} />
              <span>{errors.submit}</span>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmitClick}>
                {/* Nama item */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-item">
                    {t('item_name')} <span className="required">*</span>
                  </label>
                  <input
                    id="tx-item"
                    type="text"
                    className={`form-input ${errors.itemName ? 'error' : ''}`}
                    placeholder={t('search_placeholder')}
                    value={form.itemName}
                    onChange={e => {
                      setForm(prev => ({ ...prev, itemName: e.target.value }))
                      if (errors.itemName) setErrors(prev => ({ ...prev, itemName: '' }))
                    }}
                    autoFocus
                  />
                  {errors.itemName && <div className="form-error">{errors.itemName}</div>}
                </div>

                {/* Jumlah */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-amount">
                    {t('amount')} (Rp) <span className="required">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem',
                    }}>Rp</div>
                    <input
                      id="tx-amount"
                      type="text"
                      inputMode="numeric"
                      className={`form-input ${errors.amount ? 'error' : ''}`}
                      placeholder="0"
                      value={form.amount ? formatNumber(parseInt(form.amount)) : ''}
                      onChange={handleAmountChange}
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                  {errors.amount && <div className="form-error">{errors.amount}</div>}
                  {willExceed && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} />
                      {t('no_transactions')} ({formatRupiah(remaining)})!
                    </div>
                  )}
                </div>

                {/* Kategori */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-category">
                    {t('category')} <span className="required">*</span>
                  </label>
                  <select
                    id="tx-category"
                    className={`form-select ${errors.category ? 'error' : ''}`}
                    value={form.category}
                    onChange={e => {
                      setForm(prev => ({ ...prev, category: e.target.value }))
                      if (errors.category) setErrors(prev => ({ ...prev, category: '' }))
                    }}
                  >
                    <option value="">-- {t('all_categories')} --</option>
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {t(c.labelKey)}
                      </option>
                    ))}
                  </select>
                  {errors.category && <div className="form-error">{errors.category}</div>}
                </div>

                {/* Tanggal */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-date">
                    {t('date')} <span className="required">*</span>
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    className={`form-input ${errors.transactionDate ? 'error' : ''}`}
                    value={form.transactionDate}
                    onChange={e => {
                      setForm(prev => ({ ...prev, transactionDate: e.target.value }))
                      if (errors.transactionDate) setErrors(prev => ({ ...prev, transactionDate: '' }))
                    }}
                    max={formatDateInput(new Date())}
                  />
                  {errors.transactionDate && <div className="form-error">{errors.transactionDate}</div>}
                </div>

                {/* Catatan */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-notes">
                    {t('notes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('cancel').toLowerCase()})</span>
                  </label>
                  <textarea
                    id="tx-notes"
                    className="form-textarea"
                    placeholder={t('search_placeholder')}
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      {t('loading')}
                    </>
                  ) : (
                    `💾 ${t('save')} ${t('add_expense')}`
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{t('edit')}</h3>
                <button className="btn-icon" onClick={() => setShowConfirm(false)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>{t('system_menu')}</p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('item_name')}</span>
                      <span style={{ fontWeight: 600 }}>{form.itemName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('amount')}</span>
                      <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.1rem' }}>{formatRupiah(parseInt(form.amount))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('category')}</span>
                      <span>{t(CATEGORIES.find(c => c.id === form.category)?.labelKey)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('date')}</span>
                      <span>{form.transactionDate}</span>
                    </div>
                  </div>
                </div>
                {willExceed && (
                  <div className="alert alert-warning" style={{ marginTop: 16 }}>
                    <AlertCircle size={16} />
                    <span>{t('no_transactions')}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={handleConfirm} id="confirm-submit">
                  ✅ {t('save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
