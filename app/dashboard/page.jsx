'use client'
// app/dashboard/page.jsx - Clean Fintech Dashboard (Option A: Mercury / Wise Style)

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/components/LanguageContext'
import CategoryBadge from '@/components/CategoryBadge'
import { DashboardSkeleton } from '@/components/Skeleton'
import { formatRupiah, formatDate, formatMonthYear, getMonthName, getBudgetStatusColor, formatMemberName, MONTH_NAMES } from '@/lib/format'
import { getCategoryInfo } from '@/lib/constants'
import { cachedFetch, peekCache, setCache } from '@/lib/clientCache'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts'
import {
  TrendingUp, ArrowRight, AlertTriangle, Info, Wallet,
  ArrowUpRight, ShieldCheck, Activity, BarChart3, PieChart as PieChartIcon, ReceiptText, Plus
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { t, language } = useLanguage()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const dashUrl = `/api/dashboard?month=${month}&year=${year}`
  const [data, setData] = useState(() => peekCache(dashUrl))
  const [loading, setLoading] = useState(() => !peekCache(dashUrl))

  const fetchDashboard = useCallback(async () => {
    const cached = peekCache(dashUrl)
    if (cached) {
      setData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    try {
      const json = await cachedFetch(dashUrl, { ttlMs: 30000 })
      setData(json)
      if (json?.summary) {
        setCache(`/api/dashboard?month=${month}&year=${year}&summaryOnly=true`, { summary: json.summary })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [dashUrl, month, year])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const statusColor = data?.summary ? getBudgetStatusColor(data.summary.remaining, data.summary.totalBudget) : 'success'
  const pct = data?.summary ? data.summary.budgetPercentUsed : 0

  const PIE_COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316', '#06b6d4', '#64748b']

  const CustomTooltipBar = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '8px 13px',
          fontSize: 12.5,
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{t('date')} {label}</div>
          <div className="tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatRupiah(payload[0].value)}</div>
        </div>
      )
    }
    return null
  }

  const CustomTooltipLine = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '9px 13px',
          fontSize: 12.5,
          boxShadow: 'var(--shadow-md)',
          display: 'grid',
          gap: 3,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>{getMonthName(label, language)} {payload[0]?.payload?.year}</div>
          <div className="tabular-nums" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{t('total_expense')}: {formatRupiah(payload[0]?.value || 0)}</div>
          {payload[1] && (
            <div className="tabular-nums" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              {t('total_budget')}: {formatRupiah(payload[1]?.value || 0)}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const balanceCardClass = statusColor === 'danger'
    ? 'card-balance-danger'
    : statusColor === 'warning'
      ? 'card-balance-warn'
      : 'card-balance'

  const balanceValueColor = statusColor === 'danger'
    ? 'var(--color-danger)'
    : statusColor === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-success)'

  return (
    <AppShell>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>{t('dashboard')}</h1>
            <p>Ringkasan arus kas &amp; anggaran periode {formatMonthYear(month, year, language)}</p>
          </div>

          {/* Month selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="form-select"
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
              style={{ width: 136, padding: '8px 12px' }}
            >
              {MONTH_NAMES[language]?.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              style={{ width: 92, padding: '8px 12px' }}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Budget alerts */}
            {data?.summary?.totalBudget === 0 && (
              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                <Info size={16} />
                <span>
                  {t('current_month_limit')} {formatMonthYear(month, year, language)} — {t('set_budget_first')}.{' '}
                  <Link href="/pengaturan" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}>
                    {t('settings')} →
                  </Link>
                </span>
              </div>
            )}

            {statusColor === 'danger' && data?.summary?.totalBudget > 0 && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <AlertTriangle size={16} />
                <span>{t('budget_depleted_alert').replace(/^⚠️\s*/, '')}</span>
              </div>
            )}

            {statusColor === 'warning' && (
              <div className="alert alert-warning" style={{ marginBottom: 20 }}>
                <AlertTriangle size={16} />
                <span>{t('budget_warning_alert').replace(/^⚠️\s*/, '')}</span>
              </div>
            )}

            {/* 4 Clean Monochrome KPI Cards */}
            <div className="summary-grid fade-in-up">
              <div className="summary-card card-budget">
                <div className="summary-card-head">
                  <span className="summary-card-label">{t('total_budget')}</span>
                  <div className="summary-card-icon">
                    <Wallet size={17} strokeWidth={1.85} />
                  </div>
                </div>
                <div className="summary-card-value">{formatRupiah(data?.summary?.totalBudget || 0)}</div>
                <div className="summary-card-sub">{formatMonthYear(month, year, language)}</div>
              </div>

              <div className="summary-card card-expense">
                <div className="summary-card-head">
                  <span className="summary-card-label">{t('total_expense')}</span>
                  <div className="summary-card-icon">
                    <ArrowUpRight size={17} strokeWidth={1.85} />
                  </div>
                </div>
                <div className="summary-card-value">{formatRupiah(data?.summary?.totalExpense || 0)}</div>
                <div className="summary-card-sub tabular-nums">
                  {data?.summary?.budgetPercentUsed || 0}% {t('expense_ratio')}
                </div>
                {data?.summary?.totalBudget > 0 && (
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${pct > 95 ? 'danger' : pct > 75 ? 'warning' : ''}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className={`summary-card ${balanceCardClass}`}>
                <div className="summary-card-head">
                  <span className="summary-card-label">{t('balance')}</span>
                  <div className="summary-card-icon">
                    {statusColor === 'success' ? (
                      <ShieldCheck size={17} strokeWidth={1.85} />
                    ) : (
                      <AlertTriangle size={17} strokeWidth={1.85} />
                    )}
                  </div>
                </div>
                <div className="summary-card-value" style={{ color: balanceValueColor }}>
                  {formatRupiah(data?.summary?.remaining || 0)}
                </div>
                <div className="summary-card-sub tabular-nums">
                  {data?.summary?.totalBudget > 0
                    ? `${Math.max(0, 100 - Math.min(100, pct))}% tersisa ${t('expense_ratio')}`
                    : t('set_budget_first')}
                </div>
              </div>

              <div className="summary-card card-avg-day">
                <div className="summary-card-head">
                  <span className="summary-card-label">{t('daily_avg')}</span>
                  <div className="summary-card-icon">
                    <Activity size={17} strokeWidth={1.85} />
                  </div>
                </div>
                <div className="summary-card-value">{formatRupiah(data?.summary?.avgPerDay || 0)}</div>
                <div className="summary-card-sub">Per hari berjalan</div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              {/* Bar chart harian */}
              <div className="card chart-full">
                <div className="card-header">
                  <h3 className="card-title">
                    <BarChart3 size={16} strokeWidth={1.85} style={{ color: 'var(--color-primary-500)' }} />
                    {t('total_expense')} Harian — {formatMonthYear(month, year, language)}
                  </h3>
                </div>
                <div className="card-body">
                  {data?.dailyExpenses?.some(d => d.amount > 0) ? (
                    <ResponsiveContainer width="100%" height={224}>
                      <BarChart data={data.dailyExpenses} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => formatRupiah(v).replace('Rp ', 'Rp').replace('.000', 'k')}
                        />
                        <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(13, 148, 136, 0.08)' }} />
                        <Bar dataKey="amount" fill="#0d9488" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon"><BarChart3 size={22} /></div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Donut chart kategori */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <PieChartIcon size={16} strokeWidth={1.85} style={{ color: 'var(--color-primary-500)' }} />
                    Distribusi {t('category')}
                  </h3>
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
                          innerRadius={58}
                          outerRadius={90}
                          paddingAngle={2}
                          stroke="none"
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
                            return label.length > 20 ? label.slice(0, 20) + '…' : label
                          }}
                          wrapperStyle={{ fontSize: 11.5 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon"><PieChartIcon size={22} /></div>
                      <p>{t('no_transactions')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line chart tren bulanan */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <TrendingUp size={16} strokeWidth={1.85} style={{ color: 'var(--color-primary-500)' }} />
                    Tren 6 Bulan
                  </h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data?.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={m => getMonthName(m, language)?.slice(0, 3)}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`}
                      />
                      <Tooltip content={<CustomTooltipLine />} />
                      <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.2} dot={{ r: 3.5 }} activeDot={{ r: 5 }} name={t('total_expense')} />
                      <Line type="monotone" dataKey="budget" stroke="#10b981" strokeWidth={2.2} dot={{ r: 3.5 }} activeDot={{ r: 5 }} strokeDasharray="5 5" name={t('total_budget')} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Transaksi Terbaru */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <ReceiptText size={16} strokeWidth={1.85} style={{ color: 'var(--color-primary-500)' }} />
                  {t('recent_transactions')}
                </h3>
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
                        <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                        <th className="hide-on-mobile">{t('date')}</th>
                        <th className="hide-on-mobile">{t('member_name')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map(tx => (
                        <tr key={tx.id}>
                          <td style={{ fontWeight: 550 }}>
                            {tx.itemName}
                            <div className="show-on-mobile" style={{ fontSize: '0.74rem', marginTop: 2, color: 'var(--text-muted)' }}>
                              {formatDate(tx.transactionDate, language)}
                            </div>
                          </td>
                          <td className="hide-on-mobile"><CategoryBadge category={tx.category} size="sm" /></td>
                          <td className="tabular-nums" style={{ fontWeight: 650, textAlign: 'right', color: tx.category === 'pemasukan' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {tx.category === 'pemasukan' ? '+' : '-'}{formatRupiah(tx.amount)}
                          </td>
                          <td className="hide-on-mobile" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{formatDate(tx.transactionDate, language)}</td>
                          <td className="hide-on-mobile">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 24, height: 24,
                                  borderRadius: '50%',
                                  background: tx.member?.avatarColor || '#0d9488',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                                }}
                              >
                                {tx.member?.name?.slice(0, 2).toUpperCase() || '??'}
                              </div>
                              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }} title={tx.member?.name || '-'}>
                                {formatMemberName(tx.member?.name)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><ReceiptText size={22} /></div>
                  <h3>{t('no_transactions')}</h3>
                  <p>Belum ada transaksi tercatat pada periode ini.</p>
                  <Link href="/transaksi/baru" className="btn btn-primary" style={{ marginTop: 16 }}>
                    <Plus size={16} /> {t('add_expense')}
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
