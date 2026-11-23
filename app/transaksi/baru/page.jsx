'use client'
// app/transaksi/baru/page.jsx - Form Input Pengeluaran Baru

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/components/LanguageContext'
import CategoryIcon from '@/components/CategoryIcon'
import { CATEGORIES } from '@/lib/constants'
import { formatRupiah, formatNumber, formatDateInput } from '@/lib/format'
import { cachedFetch, peekCache, invalidateCache } from '@/lib/clientCache'
import { useToast } from '@/components/ToastContext'
import { AlertCircle, ArrowLeft, CheckCircle2, Wallet, Save, Check, X, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function NewTransactionPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()

  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()
  const summaryUrl = `/api/dashboard?month=${curMonth}&year=${curYear}&summaryOnly=true`
  const fullDashUrl = `/api/dashboard?month=${curMonth}&year=${curYear}`
  const frequentUrl = '/api/transactions?frequent=true'

  const initialCachedSummary = peekCache(summaryUrl)?.summary || peekCache(fullDashUrl)?.summary || null

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
  const [budget, setBudget] = useState(() =>
    initialCachedSummary?.totalBudget > 0 ? { amount: initialCachedSummary.totalBudget } : null
  )
  const [totalExpense, setTotalExpense] = useState(() => initialCachedSummary?.totalExpense || 0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [frequentTemplates, setFrequentTemplates] = useState(() => peekCache(frequentUrl)?.templates || [])

  // Ambil info sisa kas bulan ini & template sering dicatat
  useEffect(() => {
    router.prefetch('/transaksi')
    async function fetchBudgetSummary() {
      try {
        const dashData = await cachedFetch(summaryUrl, { ttlMs: 30000 })
        if (dashData?.summary) {
          setBudget(dashData.summary.totalBudget > 0 ? { amount: dashData.summary.totalBudget } : null)
          setTotalExpense(dashData.summary.totalExpense || 0)
        }
      } catch {}
    }
    fetchBudgetSummary()

    cachedFetch(frequentUrl, { ttlMs: 60000 })
      .then(d => {
        if (Array.isArray(d?.templates)) setFrequentTemplates(d.templates)
      })
      .catch(() => {})
  }, [router, summaryUrl, frequentUrl])

  function applyFrequentTemplate(tpl) {
    setForm(prev => ({
      ...prev,
      itemName: tpl.itemName,
      category: tpl.category,
      amount: String(tpl.amount),
    }))
    setErrors({})
    toast.info(t('frequent_template_applied').replace('{name}', tpl.itemName))
  }

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
        // Bersihkan cache transaksi & dashboard, lalu pre-fetch halaman riwayat di background
        invalidateCache(['/api/dashboard', '/api/transactions', '/api/laporan', '/api/budget'])
        cachedFetch('/api/transactions?page=1&limit=15&sortBy=transactionDate&sortOrder=desc', { forceRefresh: true }).catch(() => {})
        setSuccess(true)
        setTimeout(() => {
          router.push('/transaksi')
        }, 450)
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
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <CheckCircle2 size={32} strokeWidth={1.9} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>{t('add_expense')} — {t('success')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{t('add_expense_success_sub')}</p>
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
              <ArrowLeft size={19} strokeWidth={1.9} />
            </Link>
            <div>
              <h1>{t('add_expense')}</h1>
              <p>{t('add_expense_subtitle')}</p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Info sisa kas */}
          {budget && (
            <div
              className={`alert ${remaining <= 0 ? 'alert-danger' : remaining / budget.amount < 0.2 ? 'alert-warning' : 'alert-info'}`}
              style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <Wallet size={17} strokeWidth={1.9} />
              <span className="tabular-nums" style={{ flex: 1 }}>
                {t('balance')}: <strong>{formatRupiah(remaining)}</strong>
                {remaining <= 0 && ` — ${t('budget_depleted_alert').replace(/^⚠️\s*/, '')}`}
              </span>
            </div>
          )}

          {errors.submit && (
            <div className="alert alert-danger">
              <AlertCircle size={16} />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* 1-Tap Pintasan "Sering Dicatat" */}
          {frequentTemplates.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-body" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.76rem', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Sparkles size={13} style={{ color: 'var(--color-primary-500)' }} />
                  {t('frequent_templates_title')}
                </div>
                <div className="frequent-templates-wrap">
                  {frequentTemplates.map((tpl) => {
                    const catColor = CATEGORIES.find(c => c.id === tpl.category)?.color || '#0d9488'
                    return (
                      <button
                        key={tpl.itemName}
                        type="button"
                        className="frequent-template-chip"
                        onClick={() => applyFrequentTemplate(tpl)}
                      >
                        <CategoryIcon category={tpl.category} size={13} style={{ color: catColor }} />
                        <span>{tpl.itemName}</span>
                        <span className="frequent-template-amt">· {formatRupiah(tpl.amount)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
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
                    placeholder={t('item_placeholder')}
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
                      style={{ paddingLeft: 40, fontSize: '1.1rem', fontWeight: 600 }}
                    />
                  </div>
                  
                  {/* Pintasan Tambah Nominal Cepat */}
                  <div className="quick-amount-row">
                    {[
                      { val: 10000, label: `+10${t('amt_unit_k')}` },
                      { val: 20000, label: `+20${t('amt_unit_k')}` },
                      { val: 50000, label: `+50${t('amt_unit_k')}` },
                      { val: 100000, label: `+100${t('amt_unit_k')}` },
                      { val: 250000, label: `+250${t('amt_unit_k')}` },
                      { val: 500000, label: `+500${t('amt_unit_k')}` },
                    ].map(btn => (
                      <button
                        key={btn.val}
                        type="button"
                        className="quick-amount-btn"
                        onClick={() => {
                          const currentVal = parseInt(form.amount || '0', 10)
                          const nextVal = currentVal + btn.val
                          setForm(prev => ({ ...prev, amount: String(nextVal) }))
                          if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }))
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                    {form.amount && (
                      <button
                        type="button"
                        className="quick-amount-btn reset-btn"
                        onClick={() => setForm(prev => ({ ...prev, amount: '' }))}
                      >
                        {t('reset_label')}
                      </button>
                    )}
                  </div>

                  {errors.amount && <div className="form-error">{errors.amount}</div>}
                  {willExceed && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} />
                      {t('amount_exceeds_balance')
                        .replace('{label}', t('balance').toLowerCase())
                        .replace('{amount}', formatRupiah(remaining))}
                    </div>
                  )}
                </div>

                {/* Kategori - Visual Grid Selection */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 10 }}>
                    {t('category')} <span className="required">*</span>
                  </label>
                  
                  <div className="category-grid">
                    {CATEGORIES.map(c => {
                      const isActive = form.category === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`category-grid-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            setForm(prev => ({ ...prev, category: c.id }))
                            if (errors.category) setErrors(prev => ({ ...prev, category: '' }))
                          }}
                        >
                          <span className="category-grid-item-icon" style={{ color: isActive ? 'var(--color-primary-500)' : c.color }}>
                            <CategoryIcon category={c.id} size={18} strokeWidth={1.85} />
                          </span>
                          <span className="category-grid-item-label">{t(c.labelKey)}</span>
                        </button>
                      )
                    })}
                  </div>
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
                    {t('notes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('optional_label')}</span>
                  </label>
                  <textarea
                    id="tx-notes"
                    className="form-textarea"
                    placeholder={t('notes_placeholder')}
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
                    <span className="btn-shimmer-dot" style={{ width: 72 }} />
                  ) : (
                    <>
                      <Save size={17} strokeWidth={1.9} />
                      {t('save')} {t('add_expense')}
                    </>
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
                <h3 className="modal-title">{t('confirm_add_expense_title')}</h3>
                <button className="btn-icon" onClick={() => setShowConfirm(false)}><X size={16} /></button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{t('confirm_add_expense_desc')}</p>
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('item_name')}</span>
                      <span style={{ fontWeight: 600 }}>{form.itemName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('amount')}</span>
                      <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: '1.05rem' }}>{formatRupiah(parseInt(form.amount))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('category')}</span>
                      <span>{t(CATEGORIES.find(c => c.id === form.category)?.labelKey)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('date')}</span>
                      <span className="tabular-nums">{form.transactionDate}</span>
                    </div>
                  </div>
                </div>
                {willExceed && (
                  <div className="alert alert-warning" style={{ marginTop: 16 }}>
                    <AlertCircle size={16} />
                    <span>{t('budget_depleted_alert').replace(/^⚠️\s*/, '')}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={handleConfirm} id="confirm-submit">
                  <Check size={15} /> {t('save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
