'use client'
// app/laporan/page.jsx - Laporan & Rekap Keuangan

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@/components/UserContext'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatMonthYear, calcPercentage } from '@/lib/format'
import { CATEGORIES, getCategoryInfo } from '@/lib/constants'
import { Download, FileText, Filter } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

export default function LaporanPage() {
  const { t, language } = useLanguage()
  const { familyName } = useUser()

  // Helper untuk zona waktu Asia/Jakarta yang aman dari hydration mismatch & shift
  const getJakartaDateParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const parts = formatter.formatToParts(date)
    const partMap = {}
    parts.forEach(p => { partMap[p.type] = parseInt(p.value, 10) })
    return {
      year: partMap.year,
      month: partMap.month,
      day: partMap.day,
    }
  }

  const formatJakartaYMD = (y, m, d) => {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const todayParts = getJakartaDateParts()
  const todayStr = formatJakartaYMD(todayParts.year, todayParts.month, todayParts.day)

  const [startDate, setStartDate] = useState(formatJakartaYMD(todayParts.year, todayParts.month, 1))
  const [endDate, setEndDate] = useState(todayStr)
  const [memberId, setMemberId] = useState('')
  const [category, setCategory] = useState('')
  const [data, setData] = useState(null)
  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(d.members || []))
  }, [])

  async function fetchSummaryForMonth(m, y) {
    try {
      const res = await fetch(`/api/dashboard?month=${m}&year=${y}`)
      const d = await res.json()
      setDashboardSummary(d.summary)
    } catch {}
  }

  useEffect(() => {
    if (endDate) {
      const parts = endDate.split('-')
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10)
        if (!isNaN(year) && !isNaN(month)) {
          fetchSummaryForMonth(month, year)
        }
      }
    }
  }, [endDate])

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
    switch (preset) {
      case '7days': {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        const parts = getJakartaDateParts(d)
        setStartDate(formatJakartaYMD(parts.year, parts.month, parts.day))
        setEndDate(todayStr)
        break
      }
      case '30days': {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        const parts = getJakartaDateParts(d)
        setStartDate(formatJakartaYMD(parts.year, parts.month, parts.day))
        setEndDate(todayStr)
        break
      }
      case 'this_month': {
        setStartDate(formatJakartaYMD(todayParts.year, todayParts.month, 1))
        setEndDate(todayStr)
        break
      }
      case 'last_month': {
        let lastMonth = todayParts.month - 1
        let lastMonthYear = todayParts.year
        if (lastMonth === 0) {
          lastMonth = 12
          lastMonthYear -= 1
        }
        const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate()
        setStartDate(formatJakartaYMD(lastMonthYear, lastMonth, 1))
        setEndDate(formatJakartaYMD(lastMonthYear, lastMonth, getDaysInMonth(lastMonthYear, lastMonth)))
        break
      }
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

  // 1. Rata-rata per transaksi [NEW]
  const avgTxAmount = transactions.length > 0 ? Math.round(totalExpense / transactions.length) : 0

  // 2. Hari Terboros (Peak Day) [NEW]
  const dayNamesID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const dayNamesEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayNamesNL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

  const dayExpenses = Array(7).fill(0)
  transactions.forEach(t => {
    const d = new Date(t.transactionDate)
    const dayIndex = d.getDay()
    dayExpenses[dayIndex] += Number(t.amount)
  })

  let peakDayIndex = 0
  let maxDayExpense = 0
  dayExpenses.forEach((amt, idx) => {
    if (amt > maxDayExpense) {
      maxDayExpense = amt
      peakDayIndex = idx
    }
  })

  const getPeakDayName = () => {
    if (maxDayExpense === 0) return '-'
    if (language === 'en') return dayNamesEN[peakDayIndex]
    if (language === 'nl') return dayNamesNL[peakDayIndex]
    return dayNamesID[peakDayIndex]
  }

  const peakDayName = getPeakDayName()

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

  const getSelectedMonthYear = () => {
    if (!endDate) return { month: todayParts.month, year: todayParts.year }
    const parts = endDate.split('-')
    if (parts.length < 2) return { month: todayParts.month, year: todayParts.year }
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    if (isNaN(year) || isNaN(month)) return { month: todayParts.month, year: todayParts.year }
    return { month, year }
  }
  const { month: selectedMonth, year: selectedYear } = getSelectedMonthYear()

  return (
    <AppShell>
      <div className="page-container" id="laporan-print">
        {/* Kop Surat Laporan Cetak Formal [NEW] */}
        <div className="print-header-only" style={{ display: 'none' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
            LAPORAN KAS BUKU KELUARGA {familyName?.toUpperCase() || ''}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#475569', margin: '4px 0 16px' }}>
            Periode: {formatDate(new Date(startDate), language)} s/d {formatDate(new Date(endDate), language)}
          </p>
          <div style={{ borderBottom: '2.5px double #000', marginBottom: 24 }} />
        </div>

        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('reports')} 📄</h1>
            <p>{t('digital_cashbook')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <Download size={15} /> {t('actions')} CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <FileText size={15} /> {t('print_report')}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title"><Filter size={16} /> {t('filter_by')}</h3>
          </div>
          <div className="card-body">
            <div className="filter-bar" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('date')} ({t('history').toLowerCase()})</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('date')} ({t('total').toLowerCase()})</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('member_name')}</label>
                <select
                  className="form-select"
                  value={memberId}
                  onChange={e => setMemberId(e.target.value)}
                >
                  <option value="">{t('all_members')}</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('category')}</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">{t('all_categories')}</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {t(c.labelKey)}</option>)}
                </select>
              </div>
            </div>

            {/* Preset buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Preset:</span>
              {[
                { id: '7days', label: t('d_7days') },
                { id: '30days', label: t('d_30days') },
                { id: 'this_month', label: t('d_this_month') },
                { id: 'last_month', label: t('d_last_month') },
              ].map(p => (
                <button key={p.id} className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Realisasi Anggaran Kas [NEW] */}
        {dashboardSummary && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3 className="card-title">📊 {t('budget_vs_realization')} ({formatMonthYear(selectedMonth, selectedYear, language)})</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('total_budget')}:</span>{' '}
                  <strong style={{ fontSize: '1.05rem' }}>{formatRupiah(dashboardSummary.totalBudget)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('total_expense')}:</span>{' '}
                  <strong style={{ fontSize: '1.05rem', color: '#ef4444' }}>{formatRupiah(dashboardSummary.totalExpense)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('balance')}:</span>{' '}
                  <strong style={{ fontSize: '1.05rem', color: dashboardSummary.remaining >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatRupiah(dashboardSummary.remaining)}
                  </strong>
                </div>
              </div>
              
              {/* Progress bar */}
              {(() => {
                const pct = dashboardSummary.budgetPercentUsed
                const barColor = pct <= 75 ? '#10b981' : pct <= 95 ? '#f59e0b' : '#ef4444'
                return (
                  <div>
                    <div className="progress-bar" style={{ height: 10 }}>
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, pct)}%`, background: barColor, height: '100%', borderRadius: 99 }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{pct}% Terpakai</span>
                      <span>{pct > 100 ? 'Overbudget!' : `${100 - pct}% Tersisa`}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container"><div className="spinner" /><p>{t('loading')}</p></div>
        ) : (
          <>
            {/* Summary */}
            <div className="summary-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {/* Card 1: Total Transaksi */}
              <div className="summary-card teal">
                <div className="summary-card-icon" style={{ background: '#ccfbf1' }}>📊</div>
                <div className="summary-card-label">{t('history')}</div>
                <div className="summary-card-value">{transactions.length}</div>
                <div className="summary-card-sub">{startDate} s/d {endDate}</div>
              </div>

              {/* Card 2: Total Pengeluaran */}
              <div className="summary-card red">
                <div className="summary-card-icon" style={{ background: '#fee2e2' }}>💸</div>
                <div className="summary-card-label">{t('total_expense')}</div>
                <div className="summary-card-value">{formatRupiah(totalExpense)}</div>
                <div className="summary-card-sub">{t('digital_cashbook')}</div>
              </div>

              {/* Card 3: Rata-rata per Transaksi */}
              <div className="summary-card yellow">
                <div className="summary-card-icon" style={{ background: '#fef9c3' }}>🧮</div>
                <div className="summary-card-label">{t('avg_transaction')}</div>
                <div className="summary-card-value">{formatRupiah(avgTxAmount)}</div>
                <div className="summary-card-sub">Per transaksi dicatat</div>
              </div>

              {/* Card 4: Hari Terboros */}
              <div className="summary-card orange">
                <div className="summary-card-icon" style={{ background: '#ffedd5' }}>📅</div>
                <div className="summary-card-label">{t('most_expensive_day')}</div>
                <div className="summary-card-value" style={{ fontSize: '1.45rem' }}>{peakDayName}</div>
                <div className="summary-card-sub">{maxDayExpense > 0 ? `Total: ${formatRupiah(maxDayExpense)}` : 'Belum ada data'}</div>
              </div>

              {/* Card 5: Kategori Terboros */}
              {catBreakdown[0] ? (
                <div className="summary-card yellow" style={{ borderTop: '3px solid var(--color-warning)' }}>
                  <div className="summary-card-icon" style={{ background: '#fef9c3' }}>🏆</div>
                  <div className="summary-card-label">{t('highest_expense')} ({t('category').split(' ')[0]})</div>
                  <div className="summary-card-value" style={{ fontSize: '1.15rem' }}>
                    {getCategoryInfo(catBreakdown[0].category).emoji} {t(getCategoryInfo(catBreakdown[0].category).labelKey)}
                  </div>
                  <div className="summary-card-sub">{formatRupiah(catBreakdown[0].amount)}</div>
                </div>
              ) : (
                <div className="summary-card yellow">
                  <div className="summary-card-icon" style={{ background: '#fef9c3' }}>🏆</div>
                  <div className="summary-card-label">{t('highest_expense')}</div>
                  <div className="summary-card-value">-</div>
                  <div className="summary-card-sub">Belum ada data</div>
                </div>
              )}

              {/* Card 6: Anggota Terboros */}
              {memberBreakdown[0] ? (
                <div className="summary-card" style={{ borderTop: '3px solid #8b5cf6' }}>
                  <div className="summary-card-icon" style={{ background: '#ede9fe' }}>👤</div>
                  <div className="summary-card-label">{t('highest_expense')} ({t('member_name').split(' ')[0]})</div>
                  <div className="summary-card-value" style={{ fontSize: '1.3rem' }}>{memberBreakdown[0].name}</div>
                  <div className="summary-card-sub">{formatRupiah(memberBreakdown[0].amount)}</div>
                </div>
              ) : (
                <div className="summary-card" style={{ borderTop: '3px solid #8b5cf6' }}>
                  <div className="summary-card-icon" style={{ background: '#ede9fe' }}>👤</div>
                  <div className="summary-card-label">{t('highest_expense')}</div>
                  <div className="summary-card-value">-</div>
                  <div className="summary-card-sub">Belum ada data</div>
                </div>
              )}
            </div>

            <div className="charts-grid">
              {/* Breakdown Kategori */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('category')} Breakdown</h3>
                </div>
                <div className="card-body">
                  {catBreakdown.length === 0 ? (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">🥧</div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {catBreakdown.map(({ category: cat, amount }) => {
                        const info = getCategoryInfo(cat)
                        const pct = calcPercentage(amount, totalExpense)
                        return (
                          <div key={cat}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                              <span>{info.emoji} {t(info.labelKey)}</span>
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
                  <h3 className="card-title">{t('category')} Statistics</h3>
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
                            const label = t(info.labelKey)
                            return `${info.emoji} ${label.length > 20 ? label.slice(0, 20) + '…' : label}`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">📊</div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabel Transaksi */}
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-header">
                <h3 className="card-title">{t('history')} ({transactions.length})</h3>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  Total: {formatRupiah(totalExpense)}
                </span>
              </div>
              {transactions.length === 0 ? (
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
                        <th>{t('date')}</th>
                        <th>{t('item_name')}</th>
                        <th className="hide-on-mobile">{t('category')}</th>
                        <th>{t('amount')}</th>
                        <th className="hide-on-mobile">{t('member_name')}</th>
                        <th className="hide-on-mobile">{t('notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(t.transactionDate, language)}</td>
                          <td style={{ fontWeight: 500 }}>
                            {t.itemName}
                            <div className="show-on-mobile" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                              <CategoryBadge category={t.category} size="xs" />
                            </div>
                          </td>
                          <td className="hide-on-mobile"><CategoryBadge category={t.category} size="sm" /></td>
                          <td style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>{formatRupiah(t.amount)}</td>
                          <td className="hide-on-mobile" style={{ fontSize: '0.85rem' }}>{t.member?.name || '-'}</td>
                          <td className="hide-on-mobile" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="hide-on-mobile" />
                        <td colSpan={2} style={{ fontWeight: 700, padding: '12px 16px' }}>{t('total').toUpperCase()}</td>
                        <td style={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem', padding: '12px 16px' }}>{formatRupiah(totalExpense)}</td>
                        <td className="hide-on-mobile" colSpan={2} />
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
          /* Sembunyikan navigasi, sidebar, tombol-tombol, dan panel filter */
          .sidebar, .bottom-nav, .btn, .mobile-header, .filter-bar, .card-header button, .ai-chat-widget { 
            display: none !important; 
          }
          
          /* Atur layout halaman cetak */
          .main-content { 
            margin-left: 0 !important; 
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          
          .page-container { 
            padding: 0 !important; 
            max-width: 100% !important;
          }
          
          /* Tampilkan Kop Surat Cetak */
          .print-header-only { 
            display: block !important; 
          }
          
          /* Hilangkan style card agar menyatu di kertas print */
          .card { 
            border: none !important; 
            box-shadow: none !important; 
            margin-bottom: 20px !important;
            background: transparent !important;
            break-inside: avoid;
          }
          
          .card-body {
            padding: 0 !important;
          }
          
          /* Atur tabel agar terlihat formal hitam-putih */
          .table-container {
            border: 1px solid #000 !important;
            border-radius: 0 !important;
          }
          
          .table {
            border-collapse: collapse !important;
          }
          
          .table th {
            background: #f1f5f9 !important;
            color: #000 !important;
            border-bottom: 2px solid #000 !important;
            font-weight: 700 !important;
          }
          
          .table td {
            border-bottom: 1px solid #cbd5e1 !important;
            color: #000 !important;
          }
          
          .table tfoot td {
            border-top: 2px solid #000 !important;
            font-weight: 800 !important;
          }
        }
      `}</style>
    </AppShell>
  )
}
