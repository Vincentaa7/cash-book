'use client'
// app/laporan/page.jsx - Laporan & Rekap Keuangan

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatDateInput, formatMonthYear, getBudgetStatusColor, calcPercentage } from '@/lib/format'
import { CATEGORIES, getCategoryInfo } from '@/lib/constants'
import { Download, FileText, Filter } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

export default function LaporanPage() {
  const now = new Date()
  const [startDate, setStartDate] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [endDate, setEndDate] = useState(formatDateInput(now))
  const [memberId, setMemberId] = useState('')
  const [category, setCategory] = useState('')
  const [data, setData] = useState(null)
  const [budget, setBudget] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(d.members || []))
    fetchBudget()
  }, [])

  async function fetchBudget() {
    const res = await fetch(`/api/budget?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
    const d = await res.json()
    setBudget(d.budget)
  }

  async function handleSearch() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: 500,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(memberId && { memberId }),
        ...(category && { category }),
      })
      const res = await fetch(`/api/transactions?${params}`)
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { handleSearch() }, [startDate, endDate, memberId, category])

  function applyPreset(preset) {
    const today = new Date()
    const fmt = formatDateInput
    switch (preset) {
      case '7days':
        setStartDate(fmt(new Date(today - 7 * 86400000))); setEndDate(fmt(today)); break
      case '30days':
        setStartDate(fmt(new Date(today - 30 * 86400000))); setEndDate(fmt(today)); break
      case 'this_month':
        setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(fmt(today)); break
      case 'last_month':
        setStartDate(fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)))
        setEndDate(fmt(new Date(today.getFullYear(), today.getMonth(), 0))); break
    }
  }

  function handleExport() {
    const params = new URLSearchParams({ startDate, endDate })
    window.location.href = `/api/transactions/export?${params}`
  }

  function handlePrint() {
    window.print()
  }

  const transactions = data?.transactions || []
  const totalExpense = transactions.reduce((s, t) => s + t.amount, 0)

  // Kategori breakdown
  const catMap = {}
  transactions.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount
  })
  const catBreakdown = Object.entries(catMap)
    .map(([cat, amt]) => ({ category: cat, amount: amt }))
    .sort((a, b) => b.amount - a.amount)

  // Per anggota
  const memberMap = {}
  transactions.forEach(t => {
    const n = t.member?.name || 'Tidak diketahui'
    memberMap[n] = (memberMap[n] || 0) + t.amount
  })
  const memberBreakdown = Object.entries(memberMap)
    .map(([name, amt]) => ({ name, amount: amt }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <AppShell>
      <div className="page-container" id="laporan-print">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Laporan & Rekap 📄</h1>
            <p>Analisis pengeluaran berdasarkan rentang tanggal</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <Download size={15} /> Export CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <FileText size={15} /> Cetak
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title"><Filter size={16} /> Filter Rentang Tanggal</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Dari Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: 160 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Sampai Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ width: 160 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Anggota</label>
                <select
                  className="form-select"
                  value={memberId}
                  onChange={e => setMemberId(e.target.value)}
                  style={{ width: 150 }}
                >
                  <option value="">Semua Anggota</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Kategori</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: 200 }}
                >
                  <option value="">Semua Kategori</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.label}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Preset buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Preset:</span>
              {[
                { id: '7days', label: '7 Hari Terakhir' },
                { id: '30days', label: '30 Hari Terakhir' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
              ].map(p => (
                <button key={p.id} className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="spinner" /><p>Memuat...</p></div>
        ) : (
          <>
            {/* Summary */}
            <div className="summary-grid" style={{ marginBottom: 24 }}>
              <div className="summary-card teal">
                <div className="summary-card-icon" style={{ background: '#ccfbf1' }}>📊</div>
                <div className="summary-card-label">Total Transaksi</div>
                <div className="summary-card-value">{transactions.length}</div>
                <div className="summary-card-sub">{startDate} s/d {endDate}</div>
              </div>
              <div className="summary-card red">
                <div className="summary-card-icon" style={{ background: '#fee2e2' }}>💸</div>
                <div className="summary-card-label">Total Pengeluaran</div>
                <div className="summary-card-value">{formatRupiah(totalExpense)}</div>
                <div className="summary-card-sub">Dalam rentang yang dipilih</div>
              </div>
              {catBreakdown[0] && (
                <div className="summary-card yellow">
                  <div className="summary-card-icon" style={{ background: '#fef9c3' }}>🏆</div>
                  <div className="summary-card-label">Kategori Terbesar</div>
                  <div className="summary-card-value" style={{ fontSize: '1.1rem' }}>
                    {getCategoryInfo(catBreakdown[0].category).emoji} {catBreakdown[0].category.split('/')[0].trim()}
                  </div>
                  <div className="summary-card-sub">{formatRupiah(catBreakdown[0].amount)}</div>
                </div>
              )}
              {memberBreakdown[0] && (
                <div className="summary-card" style={{ borderTop: '3px solid #8b5cf6' }}>
                  <div className="summary-card-icon" style={{ background: '#ede9fe' }}>👤</div>
                  <div className="summary-card-label">Pengeluaran Terbanyak</div>
                  <div className="summary-card-value" style={{ fontSize: '1.2rem' }}>{memberBreakdown[0].name}</div>
                  <div className="summary-card-sub">{formatRupiah(memberBreakdown[0].amount)}</div>
                </div>
              )}
            </div>

            <div className="charts-grid">
              {/* Breakdown Kategori */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Breakdown per Kategori</h3>
                </div>
                <div className="card-body">
                  {catBreakdown.length === 0 ? (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">🥧</div>
                      <p>Tidak ada data</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {catBreakdown.map(({ category: cat, amount }) => {
                        const info = getCategoryInfo(cat)
                        const pct = calcPercentage(amount, totalExpense)
                        return (
                          <div key={cat}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                              <span>{info.emoji} {cat}</span>
                              <span style={{ fontWeight: 600 }}>{formatRupiah(amount)} ({pct}%)</span>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%`, background: info.color }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Donut Chart */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Distribusi Kategori</h3>
                </div>
                <div className="card-body">
                  {catBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={catBreakdown}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {catBreakdown.map((entry, i) => {
                            const info = getCategoryInfo(entry.category)
                            return <Cell key={i} fill={info.color} />
                          })}
                        </Pie>
                        <Tooltip formatter={v => formatRupiah(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }}
                          formatter={v => {
                            const info = getCategoryInfo(v)
                            return `${info.emoji} ${v.length > 20 ? v.slice(0, 20) + '…' : v}`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">📊</div>
                      <p>Tidak ada data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabel Transaksi */}
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-header">
                <h3 className="card-title">Daftar Transaksi ({transactions.length})</h3>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  Total: {formatRupiah(totalExpense)}
                </span>
              </div>
              {transactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Tidak ada transaksi</h3>
                  <p>Tidak ditemukan transaksi dalam rentang yang dipilih</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Item</th>
                        <th>Kategori</th>
                        <th>Nominal</th>
                        <th>Dicatat Oleh</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(t.transactionDate)}</td>
                          <td style={{ fontWeight: 500 }}>{t.itemName}</td>
                          <td><CategoryBadge category={t.category} size="sm" /></td>
                          <td style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>{formatRupiah(t.amount)}</td>
                          <td style={{ fontSize: '0.85rem' }}>{t.member?.name || '-'}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 700, padding: '12px 16px' }}>TOTAL</td>
                        <td style={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem', padding: '12px 16px' }}>{formatRupiah(totalExpense)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .sidebar, .bottom-nav, .btn { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .card { break-inside: avoid; }
        }
      `}</style>
    </AppShell>
  )
}
