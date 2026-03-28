'use client'
// app/dashboard/page.jsx - Dashboard Utama

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/components/UserContext'
import { useLanguage } from '@/components/LanguageContext'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatMonthYear, getMonthName, calcPercentage, getBudgetStatusColor, MONTH_NAMES } from '@/lib/format'
import { getCategoryInfo } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts'
import { TrendingUp, ArrowRight, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { t, language } = useLanguage()
  const { user } = useUser()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [month, year])

  async function fetchDashboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?month=${month}&year=${year}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const statusColor = data ? getBudgetStatusColor(data.summary.remaining, data.summary.totalBudget) : 'success'
  const pct = data ? data.summary.budgetPercentUsed : 0

  // Warna donut chart
  const PIE_COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316', '#06b6d4', '#94a3b8']

  const CustomTooltipBar = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('date')} {label}</div>
          <div style={{ color: 'var(--color-primary-600)' }}>{formatRupiah(payload[0].value)}</div>
        </div>
      )
    }
    return null
  }

  const CustomTooltipLine = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{getMonthName(label, language)} {payload[0]?.payload?.year}</div>
          <div style={{ color: '#ef4444' }}>{t('expense')}: {formatRupiah(payload[0]?.value || 0)}</div>
          {payload[1] && <div style={{ color: '#10b981' }}>{t('total_budget').split(' ')[1]}: {formatRupiah(payload[1]?.value || 0)}</div>}
        </div>
      )
    }
    return null
  }

  return (
    <AppShell>
      <div className="page-container">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('dashboard')} 📊</h1>
            <p>{t('digital_cashbook')}</p>
          </div>

          {/* Month selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="form-select"
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
              style={{ width: 130, padding: '8px 12px' }}
            >
              {MONTH_NAMES[language]?.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              style={{ width: 90, padding: '8px 12px' }}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <p>{t('loading')}</p>
          </div>
        ) : (
          <>
            {/* Budget warning */}
            {data?.summary.totalBudget === 0 && (
              <div className="alert alert-info" style={{ marginBottom: 24 }}>
                <Info size={16} />
                <span>
                  {t('current_month_limit')} {formatMonthYear(month, year, language)} {t('set_budget_first')}.{' '}
                  <Link href="/pengaturan" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}>
                    {t('settings')} →
                  </Link>
                </span>
              </div>
            )}

            {statusColor === 'danger' && data?.summary.totalBudget > 0 && (
              <div className="alert alert-danger" style={{ marginBottom: 24 }}>
                <AlertTriangle size={16} />
                <span>
                  ⚠️ Sisa kas sudah habis atau minus! Total pengeluaran melebihi kas yang ditetapkan.
                </span>
              </div>
            )}

            {statusColor === 'warning' && (
              <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                <AlertTriangle size={16} />
                <span>
                  {t('expense')} {pct < 100 ? 100 - pct : 0}% {t('expense_ratio')} — {t('highest_expense')}!
                </span>
              </div>
            )}

            {/* Summary Cards */}
            <div className="summary-grid fade-in-up">
              <div className="summary-card teal">
                <div className="summary-card-icon" style={{ background: '#ccfbf1' }}>💵</div>
                <div className="summary-card-label">{t('total_budget')}</div>
                <div className="summary-card-value">{formatRupiah(data?.summary.totalBudget || 0)}</div>
                <div className="summary-card-sub">{formatMonthYear(month, year, language)}</div>
              </div>

              <div className="summary-card red">
                <div className="summary-card-icon" style={{ background: '#fee2e2' }}>💸</div>
                <div className="summary-card-label">{t('total_expense')}</div>
                <div className="summary-card-value">{formatRupiah(data?.summary.totalExpense || 0)}</div>
                <div className="summary-card-sub">{data?.summary.budgetPercentUsed || 0}% {t('expense_ratio')}</div>
                {data?.summary.totalBudget > 0 && (
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${statusColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className={`summary-card ${statusColor === 'success' ? 'green' : statusColor === 'warning' ? 'yellow' : 'red'}`}>
                <div className="summary-card-icon" style={{ background: statusColor === 'success' ? '#dcfce7' : statusColor === 'warning' ? '#fef9c3' : '#fee2e2' }}>
                  {statusColor === 'success' ? '💚' : statusColor === 'warning' ? '⚠️' : '🔴'}
                </div>
                <div className="summary-card-label">{t('balance')}</div>
                <div className={`summary-card-value ${statusColor}`}>
                  {formatRupiah(data?.summary.remaining || 0)}
                </div>
                <div className="summary-card-sub">
                  {data?.summary.totalBudget > 0
                    ? `${t('success')}: ${100 - Math.min(100, pct)}%`
                    : t('set_budget_first')}
                </div>
              </div>

              <div className="summary-card yellow">
                <div className="summary-card-icon" style={{ background: '#fef9c3' }}>📈</div>
                <div className="summary-card-label">{t('daily_avg')}</div>
                <div className="summary-card-value">{formatRupiah(data?.summary.avgPerDay || 0)}</div>
                <div className="summary-card-sub">{t('digital_cashbook')}</div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              {/* Bar chart harian */}
              <div className="card chart-full">
                <div className="card-header">
                  <h3 className="card-title">{t('total_expense')} — {formatMonthYear(month, year, language)}</h3>
                </div>
                <div className="card-body">
                  {data?.dailyExpenses?.some(d => d.amount > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.dailyExpenses} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatRupiah(v).replace('Rp ', 'Rp').replace('.000', 'k')} />
                        <Tooltip content={<CustomTooltipBar />} />
                        <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">📊</div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Donut chart kategori */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('category')}</h3>
                </div>
                <div className="card-body">
                  {data?.expenseByCategory?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={data.expenseByCategory}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="45%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {data.expenseByCategory.map((entry, index) => {
                            const info = getCategoryInfo(entry.category)
                            return (
                              <Cell
                                key={index}
                                fill={info.color || PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(value)} />
                        <Legend
                          formatter={(value) => {
                            const info = getCategoryInfo(value)
                            const label = t(info.labelKey)
                            return `${info.emoji} ${label.length > 18 ? label.slice(0, 18) + '…' : label}`
                          }}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">🥧</div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line chart tren bulanan */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('statistics')}</h3>
                  <TrendingUp size={18} color="var(--color-primary-600)" />
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data?.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        tickFormatter={m => getMonthName(m, language)?.slice(0, 3)}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`}
                      />
                      <Tooltip content={<CustomTooltipLine />} />
                      <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name={t('expense')} />
                      <Line type="monotone" dataKey="budget" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" name={t('total_budget').split(' ')[1]} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Transaksi Terbaru */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('recent_transactions')}</h3>
                <Link href="/transaksi" className="btn btn-ghost btn-sm">
                  {t('view_all')} <ArrowRight size={14} />
                </Link>
              </div>
              {data?.recentTransactions?.length > 0 ? (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('item_name')}</th>
                        <th className="hide-on-mobile">{t('category')}</th>
                        <th>{t('amount')}</th>
                        <th className="hide-on-mobile">{t('date')}</th>
                        <th className="hide-on-mobile">{t('member_name')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500 }}>
                            {t.itemName}
                            <div className="show-on-mobile" style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--text-secondary)' }}>
                              {formatDate(t.transactionDate, language)}
                            </div>
                          </td>
                          <td className="hide-on-mobile"><CategoryBadge category={t.category} size="sm" /></td>
                          <td style={{ fontWeight: 600, color: '#ef4444' }}>{formatRupiah(t.amount)}</td>
                          <td className="hide-on-mobile" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatDate(t.transactionDate, language)}</td>
                          <td className="hide-on-mobile">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 26, height: 26,
                                  borderRadius: '50%',
                                  background: t.member?.avatarColor || '#0d9488',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', fontSize: '0.65rem', fontWeight: 700,
                                }}
                              >
                                {t.member?.name?.slice(0, 2).toUpperCase() || '??'}
                              </div>
                              <span style={{ fontSize: '0.875rem' }}>{t.member?.name || '-'}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <h3>{t('no_transactions')}</h3>
                  <p>{t(' 디지털_cashbook ')}</p>
                  <Link href="/transaksi/baru" className="btn btn-primary" style={{ marginTop: 16 }}>
                    + {t('add_expense')}
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
