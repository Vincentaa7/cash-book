'use client'
// app/transaksi/page.jsx - Riwayat Semua Transaksi

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/components/UserContext'
import { useLanguage } from '@/components/LanguageContext'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatDateInput } from '@/lib/format'
import { CATEGORIES, getCategoryInfo, getInitials } from '@/lib/constants'
import { Search, Download, Edit2, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function TransaksiPage() {
  const { t, language } = useLanguage()
  const { user } = useUser()
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])

  // Filters
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [memberId, setMemberId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('transactionDate')
  const [sortOrder, setSortOrder] = useState('desc')

  // Edit modal
  const [editTx, setEditTx] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)

  // Delete modal
  const [deleteTx, setDeleteTx] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // User role
  const [userRole, setUserRole] = useState('member')
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUserRole(d.user?.role)
      setUserId(d.user?.id)
    })
    fetch('/api/members').then(r => r.json()).then(d => setMembers(d.members || []))
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page, limit: 15,
        sortBy, sortOrder,
        ...(search && { search }),
        ...(category && { category }),
        ...(memberId && { memberId }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch {}
    setLoading(false)
  }, [page, search, category, memberId, startDate, endDate, sortBy, sortOrder])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  function resetFilters() {
    setSearch(''); setCategory(''); setMemberId('')
    setStartDate(''); setEndDate(''); setPage(1)
  }

  // Quick presets
  function applyPreset(preset) {
    const today = new Date()
    const fmt = formatDateInput
    switch (preset) {
      case '7days':
        setStartDate(fmt(new Date(today - 7 * 86400000)))
        setEndDate(fmt(today))
        break
      case '30days':
        setStartDate(fmt(new Date(today - 30 * 86400000)))
        setEndDate(fmt(today))
        break
      case 'this_month':
        setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1)))
        setEndDate(fmt(today))
        break
      case 'last_month':
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lme = new Date(today.getFullYear(), today.getMonth(), 0)
        setStartDate(fmt(lm)); setEndDate(fmt(lme))
        break
    }
    setPage(1)
  }

  // Export CSV
  function handleExport() {
    const params = new URLSearchParams({
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
    window.location.href = `/api/transactions/export?${params}`
  }

  // Edit
  function openEdit(tx) {
    setEditTx(tx)
    setEditForm({
      itemName: tx.itemName,
      amount: String(tx.amount),
      category: tx.category,
      transactionDate: formatDateInput(tx.transactionDate),
      notes: tx.notes || '',
    })
  }

  async function handleEditSave() {
    setEditLoading(true)
    try {
      const res = await fetch(`/api/transactions/${editTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, amount: parseInt(editForm.amount) }),
      })
      if (res.ok) {
        setEditTx(null)
        fetchTransactions()
      }
    } catch {}
    setEditLoading(false)
  }

  // Delete
  async function handleDelete() {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/transactions/${deleteTx.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteTx(null)
        fetchTransactions()
      }
    } catch {}
    setDeleteLoading(false)
  }

  const totalFiltered = transactions.reduce((s, t) => s + t.amount, 0)

  return (
    <AppShell>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>{t('history')} 📋</h1>
            <p>{t('digital_cashbook')}</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <Download size={15} /> {t('actions')} CSV
            </button>
            <Link href="/transaksi/baru" className="btn btn-primary btn-sm">
              + {t('add_expense')}
            </Link>
          </div>
        </div>

        <div className="card">
          {/* Filter bar */}
          <div className="filter-bar">
            {/* Baris 1: search + kategori + anggota */}
            <div className="filter-row" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <div className="search-input-wrapper" style={{ flex: '2 1 180px' }}>
                <Search size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('search_placeholder')}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="form-select"
                value={category}
                onChange={e => { setCategory(e.target.value); setPage(1) }}
                style={{ flex: '1 1 160px' }}
              >
                <option value="">{t('all_categories')}</option>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {t(c.labelKey)}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={memberId}
                onChange={e => { setMemberId(e.target.value); setPage(1) }}
                style={{ flex: '1 1 140px' }}
              >
                <option value="">{t('all_members')}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Baris 2: date range + presets */}
            <div className="filter-row" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 300px' }}>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>s/d</span>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 auto' }}>
                {[
                  { id: '7days', label: t('d_7days') },
                  { id: '30days', label: t('d_30days') },
                  { id: 'this_month', label: t('d_this_month') },
                  { id: 'last_month', label: t('d_last_month') },
                ].map(p => (
                  <button
                    key={p.id}
                    className="btn btn-ghost btn-sm"
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
                {(search || category || memberId || startDate || endDate) && (
                  <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ color: 'var(--color-danger)' }}>
                    <X size={13} /> {t('cancel')}
                  </button>
                )}
              </div>
            </div>

            {/* Summary filter */}
            {(startDate || endDate || search || category || memberId) && (
              <div style={{ width: '100%', padding: '10px 0 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {t('view_all')} {transactions.length} / {total} {t('history')}
                </span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  Total: {formatRupiah(totalFiltered)}
                </span>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading-container"><div className="spinner" /><p>{t('loading')}</p></div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>{t('no_transactions')}</h3>
              <p>{t('digital_cashbook')}</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('transactionDate')} style={{ width: '22%' }}>
                      {t('date')} {sortBy === 'transactionDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th style={{ width: '35%' }}>{t('item_name')}</th>
                    <th className="hide-on-mobile" style={{ width: '15%' }}>{t('category')}</th>
                    <th className="sortable" onClick={() => handleSort('amount')} style={{ width: '28%', textAlign: 'right' }}>
                      {t('amount')} {sortBy === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="hide-on-mobile" style={{ width: '15%' }}>{t('member_name')}</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const isOwner = t.memberId === userId
                    const isAdmin = userRole === 'admin'
                    const within24h = (Date.now() - new Date(t.createdAt).getTime()) < 86400000
                    const canEdit = isAdmin || (isOwner && within24h)
                    const canDelete = isAdmin

                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                          {formatDate(t.transactionDate, language)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.itemName}</div>
                          <div className="show-on-mobile" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                            <CategoryBadge category={t.category} size="xs" />
                          </div>
                          {t.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              📝 {t.notes}
                            </div>
                          )}
                        </td>
                        <td className="hide-on-mobile"><CategoryBadge category={t.category} size="sm" /></td>
                        <td style={{ fontWeight: 700, color: '#ef4444', textAlign: 'right', fontSize: '0.85rem' }}>
                          {formatRupiah(t.amount)}
                        </td>
                        <td className="hide-on-mobile">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: t.member?.avatarColor || '#0d9488',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                            }}>
                              {getInitials(t.member?.name || '?')}
                            </div>
                            <span style={{ fontSize: '0.85rem' }}>{t.member?.name || '-'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {canEdit && (
                              <button className="btn-icon" onClick={() => openEdit(t)} title="Edit">
                                <Edit2 size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button className="btn-icon" onClick={() => setDeleteTx(t)} title="Hapus" style={{ color: '#ef4444' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                {t('history')} {page} / {totalPages} ({total} {t('history').toLowerCase()})
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  className="pagination-btn"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editTx && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{t('edit')}</h3>
              <button className="btn-icon" onClick={() => setEditTx(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('item_name')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.itemName}
                  onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('amount')} (Rp)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('category')}</label>
                <select
                  className="form-select"
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {t(c.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('date')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.transactionDate}
                  onChange={e => setEditForm(f => ({ ...f, transactionDate: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('notes')}</label>
                <textarea
                  className="form-textarea"
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditTx(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editLoading}>
                {editLoading ? t('loading') : `✅ ${t('save')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTx && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{t('delete')}</h3>
              <button className="btn-icon" onClick={() => setDeleteTx(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                {t('no_transactions')}?
              </p>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600 }}>{deleteTx.itemName}</div>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>
                  {formatRupiah(deleteTx.amount)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTx(null)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? t('loading') : `🗑️ ${t('delete')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
