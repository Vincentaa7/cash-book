'use client'
// app/transaksi/page.jsx - Riwayat Semua Transaksi

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatDateInput } from '@/lib/format'
import { CATEGORIES, getCategoryInfo, getInitials } from '@/lib/constants'
import { Search, Download, Edit2, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function TransaksiPage() {
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
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Riwayat Transaksi 📋</h1>
            <p>Semua catatan pengeluaran keluarga</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <Download size={15} /> Export CSV
            </button>
            <Link href="/transaksi/baru" className="btn btn-primary btn-sm">
              + Catat Baru
            </Link>
          </div>
        </div>

        <div className="card">
          {/* Filter bar */}
          <div className="filter-bar" style={{ flexDirection: 'column', gap: 12 }}>
            {/* Baris 1: search + kategori + anggota */}
            <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
              <div className="search-input-wrapper" style={{ flex: 2, minWidth: 180 }}>
                <Search size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari item atau catatan..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="form-select"
                value={category}
                onChange={e => { setCategory(e.target.value); setPage(1) }}
                style={{ flex: 1, minWidth: 160 }}
              >
                <option value="">Semua Kategori</option>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.label}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={memberId}
                onChange={e => { setMemberId(e.target.value); setPage(1) }}
                style={{ flex: 1, minWidth: 140 }}
              >
                <option value="">Semua Anggota</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Baris 2: date range + presets */}
            <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: 150 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>s/d</span>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: 150 }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: '7days', label: '7 Hari' },
                  { id: '30days', label: '30 Hari' },
                  { id: 'this_month', label: 'Bulan Ini' },
                  { id: 'last_month', label: 'Bulan Lalu' },
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
                    <X size={13} /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Summary filter */}
            {(startDate || endDate || search || category || memberId) && (
              <div style={{ width: '100%', padding: '10px 0 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Menampilkan {transactions.length} dari {total} transaksi
                </span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  Total: {formatRupiah(totalFiltered)}
                </span>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading-container"><div className="spinner" /><p>Memuat...</p></div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>Tidak ada transaksi</h3>
              <p>Coba ubah filter atau kata kunci pencarian</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('transactionDate')}>
                      Tanggal {sortBy === 'transactionDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Item / Keperluan</th>
                    <th>Kategori</th>
                    <th className="sortable" onClick={() => handleSort('amount')}>
                      Nominal {sortBy === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Dicatat Oleh</th>
                    <th>Aksi</th>
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
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(t.transactionDate)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.itemName}</div>
                          {t.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              📝 {t.notes}
                            </div>
                          )}
                        </td>
                        <td><CategoryBadge category={t.category} size="sm" /></td>
                        <td style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>
                          {formatRupiah(t.amount)}
                        </td>
                        <td>
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
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
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
                Halaman {page} dari {totalPages} ({total} transaksi)
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
              <h3 className="modal-title">Edit Transaksi</h3>
              <button className="btn-icon" onClick={() => setEditTx(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Item</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.itemName}
                  onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Jumlah (Rp)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kategori</label>
                <select
                  className="form-select"
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.label}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.transactionDate}
                  onChange={e => setEditForm(f => ({ ...f, transactionDate: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Catatan</label>
                <textarea
                  className="form-textarea"
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditTx(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editLoading}>
                {editLoading ? 'Menyimpan...' : '✅ Simpan'}
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
              <h3 className="modal-title">Hapus Transaksi</h3>
              <button className="btn-icon" onClick={() => setDeleteTx(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                Yakin ingin menghapus transaksi ini? Tindakan ini tidak bisa dibatalkan.
              </p>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600 }}>{deleteTx.itemName}</div>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>
                  {formatRupiah(deleteTx.amount)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTx(null)}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Menghapus...' : '🗑️ Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
