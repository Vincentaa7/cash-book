'use client'
// app/pribadi/page.jsx - Halaman Buku Kas Pribadi & Saldo Utama (Per-Member, Privat)

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/components/UserContext'
import { useLanguage } from '@/components/LanguageContext'
import { formatRupiah, formatNumber, formatDate, formatDateShort, formatDateInput, getMonthName } from '@/lib/format'
import { cachedFetch, peekCache, invalidateCache } from '@/lib/clientCache'
import CategoryIcon from '@/components/CategoryIcon'
import { TableSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastContext'
import {
  Plus, Edit2, Trash2, TrendingUp, TrendingDown,
  Wallet, X, ChevronLeft, ChevronRight, Lock,
  Coins, ArrowUpRight, ArrowDownRight, Settings2, Calendar, BookOpen, Check, FileText, Info
} from 'lucide-react'

const PERSONAL_CATEGORIES = [
  { id: 'makanan',      labelKey: 'pcat_makanan' },
  { id: 'transport',    labelKey: 'pcat_transport' },
  { id: 'belanja',      labelKey: 'pcat_belanja' },
  { id: 'hiburan',      labelKey: 'pcat_hiburan' },
  { id: 'kesehatan',    labelKey: 'pcat_kesehatan' },
  { id: 'pendidikan',   labelKey: 'pcat_pendidikan' },
  { id: 'tabungan',     labelKey: 'pcat_tabungan' },
  { id: 'gaji',         labelKey: 'pcat_gaji' },
  { id: 'investasi',    labelKey: 'pcat_investasi' },
  { id: 'utilitas',     labelKey: 'pcat_utilitas' },
  { id: 'lainnya_prb',  labelKey: 'pcat_lainnya_prb' },
]

const emptyForm = {
  itemName: '', amount: '', type: 'expense',
  category: 'makanan', date: formatDateInput(new Date()), notes: '',
}

export default function PribadiPage() {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  useUser()

  // Period State (Month & Year)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear())
  const initPersonalUrl = `/api/personal?page=1&limit=15&month=${now.getMonth() + 1}&year=${now.getFullYear()}`
  const initPersonalCache = peekCache(initPersonalUrl)

  // Data State
  const [items, setItems]         = useState(() => initPersonalCache?.items || [])
  const [summary, setSummary]     = useState(() => initPersonalCache?.summary || {
    budgetAmount: 0,
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    usagePercent: 0,
    hasBudget: false,
  })
  const [total, setTotal]         = useState(() => initPersonalCache?.total || 0)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(() => initPersonalCache?.totalPages || 1)
  const [loading, setLoading]     = useState(() => !initPersonalCache)

  // Filters
  const [filterType, setFilterType]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Modals State
  const [showTxModal, setShowTxModal]         = useState(false)
  const [editItem, setEditItem]               = useState(null)
  const [txForm, setTxForm]                   = useState(emptyForm)
  const [txLoading, setTxLoading]             = useState(false)

  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetInput, setBudgetInput]         = useState('')
  const [budgetLoading, setBudgetLoading]     = useState(false)

  const [showTopupModal, setShowTopupModal]   = useState(false)
  const [topupInput, setTopupInput]           = useState('')
  const [topupNotes, setTopupNotes]           = useState('')
  const [topupLoading, setTopupLoading]       = useState(false)

  const [deleteItem, setDeleteItem]           = useState(null)
  const [delLoading, setDelLoading]           = useState(false)

  // Fetch transactions & summary for selected period
  const fetchData = useCallback(async (forceRefresh = false) => {
    const params = new URLSearchParams({
      page, limit: 15,
      month: selectedMonth,
      year:  selectedYear,
      ...(filterType     && { type: filterType }),
      ...(filterCategory && { category: filterCategory }),
    })
    const url = `/api/personal?${params}`
    const cached = !forceRefresh ? peekCache(url) : null

    if (cached) {
      setItems(cached.items || [])
      setTotal(cached.total || 0)
      setTotalPages(cached.totalPages || 1)
      if (cached.summary) setSummary(cached.summary)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const data = await cachedFetch(url, { ttlMs: 30000, forceRefresh })
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.summary) {
        setSummary(data.summary)
      }
    } catch {}
    setLoading(false)
  }, [page, selectedMonth, selectedYear, filterType, filterCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function showMsg(type, text) {
    const cleanText = String(text || '').replace(/^[✅💰➕🗑️⚠️❌]\s*/, '')
    if (type === 'success') toast.success(cleanText)
    else toast.error(cleanText)
  }

  // Month navigation handlers
  function handlePrevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(y => y - 1)
    } else {
      setSelectedMonth(m => m - 1)
    }
    setPage(1)
  }

  function handleNextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(y => y + 1)
    } else {
      setSelectedMonth(m => m + 1)
    }
    setPage(1)
  }

  function handleCurrentMonth() {
    const cur = new Date()
    setSelectedMonth(cur.getMonth() + 1)
    setSelectedYear(cur.getFullYear())
    setPage(1)
  }

  // Open transaction modal (tanggal akurat hingga tanggal 29/30/31 sesuai panjang bulan terpilih)
  function openAddTx() {
    setEditItem(null)
    const maxDay = new Date(selectedYear, selectedMonth, 0).getDate()
    const defaultDay = Math.min(new Date().getDate(), maxDay)
    setTxForm({
      ...emptyForm,
      date: formatDateInput(new Date(selectedYear, selectedMonth - 1, defaultDay))
    })
    setShowTxModal(true)
  }

  function openEditTx(item) {
    setEditItem(item)
    setTxForm({
      itemName: item.itemName,
      amount:   String(item.amount),
      type:     item.type,
      category: item.category,
      date:     formatDateInput(new Date(item.date)),
      notes:    item.notes || '',
    })
    setShowTxModal(true)
  }

  // Open budget modals
  function openSetBudget() {
    setBudgetInput(summary.budgetAmount > 0 ? String(summary.budgetAmount) : '')
    setShowBudgetModal(true)
  }

  function openTopup() {
    setTopupInput('')
    setTopupNotes('')
    setShowTopupModal(true)
  }

  // Save Transaction
  async function handleSaveTx(e) {
    e.preventDefault()
    if (!txForm.itemName.trim() || !txForm.amount || !txForm.category) return
    setTxLoading(true)
    try {
      const url    = editItem ? `/api/personal/${editItem.id}` : '/api/personal'
      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...txForm, amount: parseInt(txForm.amount) }),
      })
      if (res.ok) {
        setShowTxModal(false)
        invalidateCache('/api/personal')
        fetchData(true)
        showMsg('success', editItem ? t('personal_tx_updated') : t('personal_tx_created'))
      } else {
        const d = await res.json()
        showMsg('error', d.error || t('generic_error'))
      }
    } catch {
      showMsg('error', t('server_error'))
    }
    setTxLoading(false)
  }

  // Save Saldo Utama
  async function handleSaveBudget(e) {
    e.preventDefault()
    const amountVal = parseInt(budgetInput.replace(/[^0-9]/g, ''))
    if (!amountVal || amountVal <= 0) return
    setBudgetLoading(true)
    try {
      const res = await fetch('/api/personal/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year:  selectedYear,
          amount: amountVal,
          action: 'set',
        }),
      })
      if (res.ok) {
        setShowBudgetModal(false)
        invalidateCache('/api/personal')
        fetchData(true)
        showMsg('success', t('personal_budget_saved'))
      } else {
        const d = await res.json()
        showMsg('error', d.error || t('personal_budget_save_error'))
      }
    } catch {
      showMsg('error', t('generic_error'))
    }
    setBudgetLoading(false)
  }

  // Save Top-up
  async function handleSaveTopup(e) {
    e.preventDefault()
    const amountVal = parseInt(topupInput.replace(/[^0-9]/g, ''))
    if (!amountVal || amountVal <= 0) return
    setTopupLoading(true)
    try {
      const res = await fetch('/api/personal/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year:  selectedYear,
          amount: amountVal,
          action: 'add',
          notes: topupNotes,
        }),
      })
      if (res.ok) {
        setShowTopupModal(false)
        invalidateCache('/api/personal')
        fetchData(true)
        showMsg('success', t('personal_topup_saved'))
      } else {
        const d = await res.json()
        showMsg('error', d.error || t('personal_topup_save_error'))
      }
    } catch {
      showMsg('error', t('generic_error'))
    }
    setTopupLoading(false)
  }

  // Delete Transaction
  async function handleDeleteTx() {
    setDelLoading(true)
    try {
      const res = await fetch(`/api/personal/${deleteItem.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteItem(null)
        invalidateCache('/api/personal')
        fetchData(true)
        showMsg('success', t('personal_tx_deleted'))
      }
    } catch {}
    setDelLoading(false)
  }

  const getPersonalCatLabel = (catId) => {
    const found = PERSONAL_CATEGORIES.find(c => c.id === catId)
    return found ? t(found.labelKey) : catId
  }

  const selectedMonthName = getMonthName(selectedMonth, language)

  const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear()

  return (
    <AppShell>
      <div className="page-container">
        {/* Header Section */}
        <div className="page-header">
          <div>
            <h1>{t('personal_ledger')}</h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={13} /> {t('personal_privacy_note').replace(/^🔒\s*/, '')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="page-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={openSetBudget}
            >
              <Settings2 size={15} strokeWidth={1.85} /> {t('personal_set_balance')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={openTopup}
              style={{
                borderColor: 'rgba(13, 148, 136, 0.45)',
                color: 'var(--color-primary-500)',
              }}
            >
              <Coins size={15} strokeWidth={1.85} /> {t('personal_topup_balance')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddTx}>
              <Plus size={15} strokeWidth={2.2} /> {t('personal_add')}
            </button>
          </div>
        </div>

        {/* Month Navigator Toolbar */}
        <div className="card" style={{ marginBottom: 20, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={17} style={{ color: 'var(--color-primary-500)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              {selectedMonthName} {selectedYear}
            </span>
            {!isCurrentMonth && (
              <button className="btn btn-ghost btn-sm" onClick={handleCurrentMonth} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {t('d_this_month')}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={handlePrevMonth} title={t('prev_month')}>
              <ChevronLeft size={15} /> {t('prev_label')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleNextMonth} title={t('next_month')}>
              {t('next_label')} <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* No Budget Prompt Banner */}
        {!summary.hasBudget && (
          <div className="card" style={{
            padding: '15px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12,
            borderStyle: 'dashed',
            borderColor: 'rgba(13, 148, 136, 0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-primary-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Info size={17} />
              </div>
              <div>
                <div style={{ fontWeight: 650, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                  {t('personal_no_budget_title')}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('personal_no_budget_desc').replace('{month}', selectedMonthName)}
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openSetBudget}>
              <Settings2 size={14} /> {t('personal_set_balance_now')}
            </button>
          </div>
        )}

        {/* 4 Clean Monochrome Fintech KPI Cards (Zero Rainbow Gradients) */}
        <div className="summary-grid" style={{ marginBottom: 24 }}>
          {/* Card 1: Saldo Utama Pribadi */}
          <div className="summary-card card-budget">
            <div className="summary-card-head">
              <span className="summary-card-label">{t('personal_budget_allocated')}</span>
              <div className="summary-card-icon"><Wallet size={16} strokeWidth={1.85} /></div>
            </div>
            <div className="summary-card-value">{formatRupiah(summary.budgetAmount)}</div>
            <div className="summary-card-sub" style={{ justifyContent: 'space-between' }}>
              <span>{summary.hasBudget ? t('personal_modal_month') : t('personal_not_set')}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={openTopup}
                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
              >
                {t('personal_topup_short')}
              </button>
            </div>
          </div>

          {/* Card 2: Pengeluaran Pribadi */}
          <div className="summary-card card-expense">
            <div className="summary-card-head">
              <span className="summary-card-label">{t('personal_expense')}</span>
              <div className="summary-card-icon"><TrendingDown size={16} strokeWidth={1.85} /></div>
            </div>
            <div className="summary-card-value" style={{ color: 'var(--color-danger)' }}>{formatRupiah(summary.totalExpense)}</div>
            <div className="summary-card-sub tabular-nums">
              {summary.hasBudget ? t('personal_of_main_balance').replace('{pct}', summary.usagePercent) : t('personal_total_spent_month')}
            </div>
          </div>

          {/* Card 3: Pemasukan Tambahan */}
          <div className="summary-card card-balance">
            <div className="summary-card-head">
              <span className="summary-card-label">{t('personal_income')}</span>
              <div className="summary-card-icon"><TrendingUp size={16} strokeWidth={1.85} /></div>
            </div>
            <div className="summary-card-value" style={{ color: 'var(--color-success)' }}>{formatRupiah(summary.totalIncome)}</div>
            <div className="summary-card-sub">{t('personal_topup_extra_sub')}</div>
          </div>

          {/* Card 4: Sisa Saldo Kas */}
          <div className={`summary-card ${summary.balance < 0 ? 'card-balance-danger' : 'card-history'}`}>
            <div className="summary-card-head">
              <span className="summary-card-label">{t('personal_balance')}</span>
              <div className="summary-card-icon"><Coins size={16} strokeWidth={1.85} /></div>
            </div>
            <div className="summary-card-value" style={{ color: summary.balance < 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
              {formatRupiah(summary.balance)}
            </div>
            {summary.hasBudget ? (
              <div className="progress-bar">
                <div
                  className={`progress-fill ${summary.usagePercent > 95 ? 'danger' : summary.usagePercent > 80 ? 'warning' : ''}`}
                  style={{ width: `${Math.min(summary.usagePercent, 100)}%` }}
                />
              </div>
            ) : (
              <div className="summary-card-sub">{summary.balance < 0 ? t('personal_deficit') : t('personal_net_balance_month')}</div>
            )}
          </div>
        </div>

        {/* Transaction Card & Filter */}
        <div className="card">
          {/* Filters Bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              <select
                className="form-select"
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setPage(1) }}
                style={{ flex: '1 1 130px', maxWidth: 180 }}
              >
                <option value="">{t('personal_all_types')}</option>
                <option value="expense">{t('personal_expense_only')}</option>
                <option value="income">{t('personal_income_only')}</option>
              </select>

              <select
                className="form-select"
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
                style={{ flex: '1 1 160px', maxWidth: 220 }}
              >
                <option value="">{t('all_categories')}</option>
                {PERSONAL_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{t(c.labelKey)}</option>
                ))}
              </select>

              {(filterType || filterCategory) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setFilterType(''); setFilterCategory(''); setPage(1) }}
                  style={{ color: 'var(--color-danger)' }}
                >
                  <X size={13} /> {t('personal_reset_filter')}
                </button>
              )}
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {t('personal_total_tx').replace('{count}', total)}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <TableSkeleton rows={6} />
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><BookOpen size={22} /></div>
              <h3>{t('personal_empty')}</h3>
              <p>{t('personal_empty_sub')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" onClick={openSetBudget}>
                  <Settings2 size={15} /> {t('personal_set_balance')}
                </button>
                <button className="btn btn-primary btn-sm" onClick={openAddTx}>
                  <Plus size={15} /> {t('personal_add')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container desktop-table-only" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>{t('date')}</th>
                      <th>{t('item_name')}</th>
                      <th style={{ whiteSpace: 'nowrap' }}>{t('category')}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{t('amount')}</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(item.date, language)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 550, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                              background: item.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                              color: item.type === 'income' ? '#10b981' : '#ef4444',
                              display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0,
                            }}>
                              {item.type === 'income' ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                              {item.type === 'income' ? t('personal_in_badge') : t('personal_out_badge')}
                            </span>
                            <span>{item.itemName}</span>
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <FileText size={11} style={{ flexShrink: 0 }} /> {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                            <CategoryIcon category={item.category} size={13} />
                            {getPersonalCatLabel(item.category)}
                          </span>
                        </td>
                        <td className="tabular-nums" style={{
                          textAlign: 'right', fontWeight: 700, fontSize: '0.855rem', whiteSpace: 'nowrap',
                          color: item.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <button
                              className="btn-icon"
                              onClick={() => openEditTx(item)}
                              title={t('edit')}
                              style={{ flexShrink: 0, minWidth: 30, minHeight: 30 }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => setDeleteItem(item)}
                              title={t('delete')}
                              style={{ color: '#ef4444', flexShrink: 0, minWidth: 30, minHeight: 30 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Fintech Ledger List */}
              <div className="mobile-ledger-only tx-mobile-list">
                {items.map(item => (
                  <div key={item.id} className="tx-mobile-row">
                    <div className="tx-mobile-top">
                      <div className="tx-mobile-title" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.64rem', fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                          background: item.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                          color: item.type === 'income' ? '#10b981' : '#ef4444',
                          display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, marginTop: 1,
                        }}>
                          {item.type === 'income' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                          {item.type === 'income' ? t('personal_in_badge') : t('personal_out_badge')}
                        </span>
                        <span>{item.itemName}</span>
                      </div>
                      <div
                        className="tx-mobile-amount"
                        style={{ color: item.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}
                      >
                        {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
                      </div>
                    </div>

                    <div className="tx-mobile-meta">
                      <div className="tx-mobile-meta-left">
                        <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          <CategoryIcon category={item.category} size={11} />
                          {getPersonalCatLabel(item.category)}
                        </span>
                        <span className="tx-mobile-date">{formatDateShort(item.date, language)}</span>
                      </div>
                      <div className="tx-mobile-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEditTx(item)}
                          title={t('edit')}
                          style={{ width: 30, height: 30 }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setDeleteItem(item)}
                          title={t('delete')}
                          style={{ color: 'var(--color-danger)', width: 30, height: 30 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="tx-mobile-note">
                        <FileText size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{item.notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                {t('personal_page_info')
                  .replace('{page}', page)
                  .replace('{totalPages}', totalPages)
                  .replace('{total}', total)}
              </span>
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pn = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={pn} className={`pagination-btn ${page === pn ? 'active' : ''}`} onClick={() => setPage(pn)}>
                      {pn}
                    </button>
                  )
                })}
                <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Atur Saldo Utama */}
      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Wallet size={17} /> {t('personal_set_balance')}</h3>
              <button className="btn-icon" onClick={() => setShowBudgetModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveBudget}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{t('personal_period_label')}</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-500)', fontSize: '0.95rem' }}>
                    {selectedMonthName} {selectedYear}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('personal_budget_allocated')} (Rp) <span className="required">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>Rp</div>
                    <input
                      type="text" inputMode="numeric" className="form-input" required autoFocus
                      style={{ paddingLeft: 42, fontSize: '1.1rem', fontWeight: 700 }}
                      value={budgetInput ? formatNumber(parseInt(budgetInput)) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setBudgetInput(raw)
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('personal_quick_presets')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[1000000, 2000000, 3000000, 5000000, 10000000].map(val => (
                      <button
                        key={val} type="button" className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
                        onClick={() => setBudgetInput(String(val))}
                      >
                        {formatRupiah(val)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBudgetModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={budgetLoading}>
                  {budgetLoading ? <span className="btn-shimmer-dot" /> : <><Check size={15} /> {t('save')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Tambah Saldo (Top-Up) */}
      {showTopupModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Coins size={17} /> {t('personal_topup_balance')}</h3>
              <button className="btn-icon" onClick={() => setShowTopupModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveTopup}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('personal_current_main_balance')}</span>
                  <span style={{ fontWeight: 800, color: 'var(--color-primary-500)', fontSize: '1rem' }}>{formatRupiah(summary.budgetAmount)}</span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('personal_topup_amount')} (Rp) <span className="required">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>Rp</div>
                    <input
                      type="text" inputMode="numeric" className="form-input" required autoFocus
                      style={{ paddingLeft: 42, fontSize: '1.1rem', fontWeight: 700 }}
                      value={topupInput ? formatNumber(parseInt(topupInput)) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setTopupInput(raw)
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('personal_quick_presets')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[100000, 250000, 500000, 1000000, 2000000].map(val => (
                      <button
                        key={val} type="button" className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
                        onClick={() => {
                          const cur = parseInt(topupInput.replace(/[^0-9]/g, '')) || 0
                          setTopupInput(String(cur + val))
                        }}
                      >
                        +{formatRupiah(val)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('notes')} {t('optional_label')}</label>
                  <input
                    type="text" className="form-input"
                    value={topupNotes}
                    onChange={e => setTopupNotes(e.target.value)}
                    placeholder={t('personal_topup_notes_placeholder')}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTopupModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={topupLoading}>
                  {topupLoading ? <span className="btn-shimmer-dot" /> : <><Plus size={15} /> {t('personal_add_balance_btn')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Catat / Edit Transaksi */}
      {showTxModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editItem ? <><Edit2 size={16} /> {t('personal_edit_record')}</> : <><Plus size={16} /> {t('personal_add')}</>}
              </h3>
              <button className="btn-icon" onClick={() => setShowTxModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveTx}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                {/* Tipe Transaksi (dikunci jika sedang edit Top-Up Saldo Utama) */}
                {(() => {
                  const isEditingTopup = editItem?.itemName === 'Tambah Saldo (Top-Up)' && editItem?.type === 'income'
                  return (
                    <>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{t('personal_tx_type')}</span>
                          {isEditingTopup && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Lock size={11} /> {t('personal_locked_topup')}
                            </span>
                          )}
                        </label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {['expense', 'income'].map(tp => (
                            <button
                              key={tp} type="button"
                              disabled={isEditingTopup}
                              onClick={() => !isEditingTopup && setTxForm(f => ({ ...f, type: tp }))}
                              style={{
                                flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid',
                                borderColor: txForm.type === tp
                                  ? (tp === 'income' ? 'var(--color-success)' : 'var(--color-danger)')
                                  : 'var(--border-color)',
                                background: txForm.type === tp
                                  ? (tp === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)')
                                  : 'var(--bg-secondary)',
                                color: txForm.type === tp
                                  ? (tp === 'income' ? 'var(--color-success)' : 'var(--color-danger)')
                                  : 'var(--text-secondary)',
                                fontWeight: 650, cursor: isEditingTopup ? 'not-allowed' : 'pointer',
                                opacity: isEditingTopup && txForm.type !== tp ? 0.4 : 1,
                                transition: 'all 0.18s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                              }}
                            >
                              {tp === 'income' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                              {tp === 'income' ? t('personal_type_income') : t('personal_type_expense')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nama Item */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">{t('item_name')} <span className="required">*</span></label>
                        <input
                          type="text" className="form-input" required
                          value={txForm.itemName}
                          readOnly={isEditingTopup}
                          style={isEditingTopup ? { opacity: 0.72, cursor: 'not-allowed' } : {}}
                          onChange={e => !isEditingTopup && setTxForm(f => ({ ...f, itemName: e.target.value }))}
                          placeholder={t('personal_item_placeholder')}
                        />
                      </div>
                    </>
                  )
                })()}

                {/* Nominal */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('amount')} (Rp) <span className="required">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>Rp</div>
                    <input
                      type="text" inputMode="numeric" className="form-input" required
                      style={{ paddingLeft: 42, fontSize: '1.05rem', fontWeight: 700 }}
                      value={txForm.amount ? formatNumber(parseInt(txForm.amount)) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setTxForm(f => ({ ...f, amount: raw }))
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Kategori Visual Grid */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('category')} <span className="required">*</span></label>
                  <div className="category-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))' }}>
                    {PERSONAL_CATEGORIES.map(c => (
                      <button
                        key={c.id} type="button"
                        onClick={() => setTxForm(f => ({ ...f, category: c.id }))}
                        className={`category-grid-item ${txForm.category === c.id ? 'active' : ''}`}
                        style={{ padding: '10px 6px' }}
                      >
                        <span className="category-grid-item-icon" style={{ width: 28, height: 28 }}>
                          <CategoryIcon category={c.id} size={15} />
                        </span>
                        <span className="category-grid-item-label">{t(c.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tanggal */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('date')}</label>
                  <input
                    type="date" className="form-input"
                    value={txForm.date}
                    onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>

                {/* Catatan */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('notes')}</label>
                  <textarea
                    className="form-textarea" rows={2}
                    value={txForm.notes}
                    onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={t('notes_placeholder')}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={txLoading}>
                  {txLoading ? <span className="btn-shimmer-dot" /> : <><Check size={15} /> {t('save')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Hapus Konfirmasi */}
      {deleteItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Trash2 size={16} /> {t('personal_delete_record')}</h3>
              <button className="btn-icon" onClick={() => setDeleteItem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{t('personal_confirm_delete')}</p>
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 600 }}>{deleteItem.itemName}</div>
                <div className="tabular-nums" style={{
                  color: deleteItem.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                  fontWeight: 700, fontSize: '1.05rem', marginTop: 4
                }}>
                  {deleteItem.type === 'income' ? '+' : '-'}{formatRupiah(deleteItem.amount)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDeleteTx} disabled={delLoading}>
                {delLoading ? <span className="btn-shimmer-dot" /> : <><Trash2 size={14} /> {t('delete')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
