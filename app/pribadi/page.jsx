'use client'
// app/pribadi/page.jsx - Halaman Buku Kas Pribadi & Saldo Utama (Per-Member, Privat)

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/components/UserContext'
import { useLanguage } from '@/components/LanguageContext'
import { formatRupiah, formatNumber, formatDate, formatDateInput } from '@/lib/format'
import {
  Plus, Edit2, Trash2, TrendingUp, TrendingDown,
  Wallet, X, ChevronLeft, ChevronRight, Lock,
  Coins, ArrowUpRight, ArrowDownRight, Settings2, Calendar
} from 'lucide-react'

const PERSONAL_CATEGORIES = [
  { id: 'makanan',      emoji: '🍔', label: 'Makan & Minum' },
  { id: 'transport',    emoji: '🚗', label: 'Transport' },
  { id: 'belanja',      emoji: '🛍️', label: 'Belanja' },
  { id: 'hiburan',      emoji: '🎮', label: 'Hiburan' },
  { id: 'kesehatan',    emoji: '💊', label: 'Kesehatan' },
  { id: 'pendidikan',   emoji: '📚', label: 'Pendidikan' },
  { id: 'tabungan',     emoji: '🏦', label: 'Tabungan' },
  { id: 'gaji',         emoji: '💰', label: 'Gaji / Pemasukan' },
  { id: 'investasi',    emoji: '📈', label: 'Investasi' },
  { id: 'utilitas',     emoji: '💡', label: 'Tagihan / Utilitas' },
  { id: 'lainnya_prb',  emoji: '📦', label: 'Lainnya' },
]

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const emptyForm = {
  itemName: '', amount: '', type: 'expense',
  category: 'makanan', date: formatDateInput(new Date()), notes: '',
}

export default function PribadiPage() {
  const { t, language } = useLanguage()
  useUser()

  // Period State (Month & Year)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear())

  // Data State
  const [items, setItems]         = useState([])
  const [summary, setSummary]     = useState({
    budgetAmount: 0,
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    usagePercent: 0,
    hasBudget: false,
  })
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]     = useState(true)

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

  const [msg, setMsg]                         = useState(null) // { type: 'success'|'error', text }

  // Fetch transactions & summary for selected period
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page, limit: 15,
        month: selectedMonth,
        year:  selectedYear,
        ...(filterType     && { type: filterType }),
        ...(filterCategory && { category: filterCategory }),
      })
      const res  = await fetch(`/api/personal?${params}`)
      const data = await res.json()
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
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
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

  // Open transaction modal
  function openAddTx() {
    setEditItem(null)
    setTxForm({
      ...emptyForm,
      date: formatDateInput(new Date(selectedYear, selectedMonth - 1, Math.min(new Date().getDate(), 28)))
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
        fetchData()
        showMsg('success', editItem ? '✅ Catatan berhasil diperbarui!' : '✅ Transaksi berhasil dicatat!')
      } else {
        const d = await res.json()
        showMsg('error', d.error || 'Terjadi kesalahan')
      }
    } catch {
      showMsg('error', 'Terjadi kesalahan server')
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
        fetchData()
        showMsg('success', '💰 Saldo utama kas pribadi berhasil diatur!')
      } else {
        const d = await res.json()
        showMsg('error', d.error || 'Gagal menyimpan saldo utama')
      }
    } catch {
      showMsg('error', 'Terjadi kesalahan')
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
        fetchData()
        showMsg('success', '➕ Saldo kas pribadi berhasil ditambah (Top-up)!')
      } else {
        const d = await res.json()
        showMsg('error', d.error || 'Gagal menambah saldo')
      }
    } catch {
      showMsg('error', 'Terjadi kesalahan')
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
        fetchData()
        showMsg('success', '🗑️ Catatan berhasil dihapus!')
      }
    } catch {}
    setDelLoading(false)
  }

  const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear()

  return (
    <AppShell>
      <div className="page-container">
        {/* Header Section */}
        <div className="page-header" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('personal_ledger')} <span style={{ fontSize: '1.4rem' }}>📓</span>
            </h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Lock size={13} /> {t('personal_privacy_note')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="page-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={openSetBudget}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Settings2 size={15} /> {t('personal_set_balance')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={openTopup}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1.5px solid var(--color-primary-500)',
                color: 'var(--color-primary-500)'
              }}
            >
              <Coins size={15} /> {t('personal_topup_balance')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddTx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> {t('personal_add')}
            </button>
          </div>
        </div>

        {/* Status Message Alert */}
        {msg && (
          <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 20 }}>
            <span>{msg.text}</span>
          </div>
        )}

        {/* Month Navigator Toolbar */}
        <div className="card" style={{ marginBottom: 20, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={18} style={{ color: 'var(--color-primary-500)' }} />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            {!isCurrentMonth && (
              <button className="btn btn-ghost btn-sm" onClick={handleCurrentMonth} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                Bulan Ini
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={handlePrevMonth} title="Bulan Sebelumnya">
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleNextMonth} title="Bulan Berikutnya">
              Berikutnya <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* No Budget Prompt Banner */}
        {!summary.hasBudget && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.1) 0%, rgba(20, 184, 166, 0.05) 100%)',
            border: '1.5px dashed var(--color-primary-500)',
            borderRadius: 16,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                💡 Saldo Utama Pribadi Belum Diatur
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tentukan modal kas pribadi bulan {MONTH_NAMES[selectedMonth - 1]} agar sisa saldo dan batas belanja dapat terpantau rapi.
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openSetBudget}>
              <Settings2 size={14} /> Atur Saldo Sekarang
            </button>
          </div>
        )}

        {/* 4 Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Card 1: Saldo Utama Pribadi */}
          <div style={{
            borderRadius: 16, padding: '20px 22px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            color: 'white', boxShadow: '0 8px 20px -6px rgba(13,148,136,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            position: 'relative', overflow: 'hidden'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wallet size={16} style={{ opacity: 0.9 }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                    {t('personal_budget_allocated')}
                  </span>
                </div>
                <button
                  onClick={openTopup}
                  title="Top-Up Saldo"
                  style={{
                    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6,
                    color: 'white', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px',
                    cursor: 'pointer'
                  }}
                >
                  + Top-Up
                </button>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.2 }}>
                {formatRupiah(summary.budgetAmount)}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 10 }}>
              {summary.hasBudget ? 'Modal Kas Bulan Ini' : 'Belum diatur'}
            </div>
          </div>

          {/* Card 2: Pengeluaran Pribadi */}
          <div style={{
            borderRadius: 16, padding: '20px 22px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white', boxShadow: '0 8px 20px -6px rgba(239,68,68,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingDown size={16} style={{ opacity: 0.9 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                  {t('personal_expense')}
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.2 }}>
                {formatRupiah(summary.totalExpense)}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 10 }}>
              {summary.hasBudget ? `${summary.usagePercent}% dari saldo utama` : 'Total belanja bulan ini'}
            </div>
          </div>

          {/* Card 3: Pemasukan Tambahan */}
          <div style={{
            borderRadius: 16, padding: '20px 22px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white', boxShadow: '0 8px 20px -6px rgba(16,185,129,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={16} style={{ opacity: 0.9 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                  {t('personal_income')}
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.2 }}>
                {formatRupiah(summary.totalIncome)}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 10 }}>
              Top-up & pemasukan tambahan
            </div>
          </div>

          {/* Card 4: Sisa Saldo Kas */}
          <div style={{
            borderRadius: 16, padding: '20px 22px',
            background: summary.balance >= 0
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
            color: 'white',
            boxShadow: summary.balance >= 0
              ? '0 8px 20px -6px rgba(59,130,246,0.5)'
              : '0 8px 20px -6px rgba(168,85,247,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Coins size={16} style={{ opacity: 0.9 }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                    {t('personal_balance')}
                  </span>
                </div>
                {summary.balance < 0 && (
                  <span style={{ background: 'rgba(239,68,68,0.3)', padding: '2px 6px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700 }}>
                    Defisit
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.2 }}>
                {formatRupiah(summary.balance)}
              </div>
            </div>

            {/* Mini Progress Bar */}
            {summary.hasBudget && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 99,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(summary.usagePercent, 100)}%`,
                    background: summary.usagePercent > 100 ? '#f87171' : summary.usagePercent > 85 ? '#fcd34d' : '#ffffff',
                    borderRadius: 99,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
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
                <option value="">Semua Tipe</option>
                <option value="expense">Pengeluaran Saja</option>
                <option value="income">Pemasukan / Top-up Saja</option>
              </select>

              <select
                className="form-select"
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
                style={{ flex: '1 1 160px', maxWidth: 220 }}
              >
                <option value="">Semua Kategori</option>
                {PERSONAL_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>

              {(filterType || filterCategory) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setFilterType(''); setFilterCategory(''); setPage(1) }}
                  style={{ color: 'var(--color-danger)' }}
                >
                  <X size={13} /> Reset Filter
                </button>
              )}
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Total: {total} Transaksi
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading-container"><div className="spinner" /><p>{t('loading')}</p></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📓</div>
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
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>{t('date')}</th>
                    <th style={{ width: '38%' }}>{t('item_name')}</th>
                    <th className="hide-on-mobile" style={{ width: '18%' }}>Kategori</th>
                    <th style={{ width: '22%', textAlign: 'right' }}>{t('amount')}</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatDate(item.date, language)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                            background: item.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                            color: item.type === 'income' ? '#10b981' : '#ef4444',
                            display: 'inline-flex', alignItems: 'center', gap: 2
                          }}>
                            {item.type === 'income' ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                            {item.type === 'income' ? 'Masuk' : 'Keluar'}
                          </span>
                          <span>{item.itemName}</span>
                        </div>
                        {item.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>📝 {item.notes}</div>
                        )}
                        <div className="show-on-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {PERSONAL_CATEGORIES.find(c => c.id === item.category)?.emoji} {PERSONAL_CATEGORIES.find(c => c.id === item.category)?.label || item.category}
                        </div>
                      </td>
                      <td className="hide-on-mobile" style={{ fontSize: '0.82rem' }}>
                        {PERSONAL_CATEGORIES.find(c => c.id === item.category)?.emoji} {PERSONAL_CATEGORIES.find(c => c.id === item.category)?.label || item.category}
                      </td>
                      <td style={{
                        textAlign: 'right', fontWeight: 700, fontSize: '0.85rem',
                        color: item.type === 'income' ? 'var(--color-success)' : '#ef4444',
                      }}>
                        {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button className="btn-icon" onClick={() => openEditTx(item)} title="Edit"><Edit2 size={14} /></button>
                          <button className="btn-icon" onClick={() => setDeleteItem(item)} title="Hapus" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                Halaman {page} / {totalPages} ({total} catatan)
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
              <h3 className="modal-title">💰 {t('personal_set_balance')}</h3>
              <button className="btn-icon" onClick={() => setShowBudgetModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveBudget}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Periode:</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-500)', fontSize: '0.95rem' }}>
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Pilihan Cepat:</div>
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
                  {budgetLoading ? t('loading') : `✅ ${t('save')}`}
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
              <h3 className="modal-title">➕ {t('personal_topup_balance')}</h3>
              <button className="btn-icon" onClick={() => setShowTopupModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTopup}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Saldo Utama Saat Ini:</span>
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Pilihan Cepat:</div>
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
                  <label className="form-label">{t('notes')} (Opsional)</label>
                  <input
                    type="text" className="form-input"
                    value={topupNotes}
                    onChange={e => setTopupNotes(e.target.value)}
                    placeholder="Contoh: Transfer rekening, bonus tambahan..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTopupModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={topupLoading}>
                  {topupLoading ? t('loading') : '➕ Tambah Saldo'}
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
                {editItem ? `✏️ ${t('edit')} Catatan` : `➕ ${t('personal_add')}`}
              </h3>
              <button className="btn-icon" onClick={() => setShowTxModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTx}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                {/* Tipe Transaksi */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tipe Transaksi</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['expense', 'income'].map(tp => (
                      <button
                        key={tp} type="button"
                        onClick={() => setTxForm(f => ({ ...f, type: tp }))}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 10, border: '2px solid',
                          borderColor: txForm.type === tp
                            ? (tp === 'income' ? 'var(--color-success)' : '#ef4444')
                            : 'var(--border-color)',
                          background: txForm.type === tp
                            ? (tp === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)')
                            : 'var(--bg-secondary)',
                          color: txForm.type === tp
                            ? (tp === 'income' ? 'var(--color-success)' : '#ef4444')
                            : 'var(--text-secondary)',
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {tp === 'income' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
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
                    onChange={e => setTxForm(f => ({ ...f, itemName: e.target.value }))}
                    placeholder="Contoh: Makan siang, Bensin, Gaji freelance..."
                  />
                </div>

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
                  <label className="form-label">Kategori <span className="required">*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                    {PERSONAL_CATEGORIES.map(c => (
                      <button
                        key={c.id} type="button"
                        onClick={() => setTxForm(f => ({ ...f, category: c.id }))}
                        style={{
                          padding: '8px 6px', borderRadius: 8, border: '2px solid',
                          borderColor: txForm.category === c.id ? 'var(--color-primary-600)' : 'var(--border-color)',
                          background: txForm.category === c.id ? 'var(--color-primary-hover)' : 'var(--bg-secondary)',
                          color: txForm.category === c.id ? 'var(--color-primary-600)' : 'var(--text-secondary)',
                          fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: '1.2rem', marginBottom: 3 }}>{c.emoji}</div>
                        {c.label}
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
                    placeholder="Catatan tambahan (opsional)..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={txLoading}>
                  {txLoading ? t('loading') : `✅ ${t('save')}`}
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
              <h3 className="modal-title">🗑️ {t('delete')} Catatan</h3>
              <button className="btn-icon" onClick={() => setDeleteItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{t('personal_confirm_delete')}</p>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600 }}>{deleteItem.itemName}</div>
                <div style={{
                  color: deleteItem.type === 'income' ? 'var(--color-success)' : '#ef4444',
                  fontWeight: 700, fontSize: '1.05rem', marginTop: 4
                }}>
                  {deleteItem.type === 'income' ? '+' : '-'}{formatRupiah(deleteItem.amount)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDeleteTx} disabled={delLoading}>
                {delLoading ? t('loading') : `🗑️ ${t('delete')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
