'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/components/LanguageContext'
import { formatRupiah, formatMonthYear } from '@/lib/format'
import { getCategoryInfo } from '@/lib/constants'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react'

export default function CalendarPage() {
  const { t, language } = useLanguage()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null) // number

  const fetchMonthTransactions = useCallback(async () => {
    setLoading(true)
    try {
      // Ambil transaksi bulan ini (limit besar agar terambil semua)
      const res = await fetch(`/api/transactions?month=${month}&year=${year}&limit=1000`)
      if (res.ok) {
        const json = await res.json()
        setTransactions(json.transactions || [])
      }
    } catch (e) {
      console.error('Fetch calendar error:', e)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    fetchMonthTransactions()
    setSelectedDay(null)
  }, [fetchMonthTransactions])

  // Hitung jumlah hari di bulan berjalan
  const daysInMonth = new Date(year, month, 0).getDate()
  // Hari pertama bulan berjalan jatuh di hari apa (0: Minggu, 1: Senin, ...)
  const firstDayIndex = new Date(year, month - 1, 1).getDay()

  // Kelompokkan transaksi berdasarkan tanggal hari (1 - daysInMonth)
  const dayStats = {}
  for (let d = 1; d <= daysInMonth; d++) {
    dayStats[d] = {
      expenses: 0,
      incomes: 0,
      items: []
    }
  }

  transactions.forEach(t => {
    const dateObj = new Date(t.transactionDate)
    const day = dateObj.getDate()
    if (dayStats[day]) {
      dayStats[day].items.push(t)
      if (t.category === 'pemasukan') {
        dayStats[day].incomes += Number(t.amount)
      } else {
        dayStats[day].expenses += Number(t.amount)
      }
    }
  })

  // Navigasi Bulan
  function handlePrevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  // Navigasi Bulan berikutnya
  function handleNextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  // Menentukan kelas warna intensitas pengeluaran
  function getIntensityClass(expenseAmount) {
    if (expenseAmount === 0) return 'cal-empty'
    if (expenseAmount <= 150000) return 'cal-low'
    if (expenseAmount <= 500000) return 'cal-medium'
    return 'cal-high'
  }

  const selectedDayData = selectedDay ? dayStats[selectedDay] : null

  // Nama hari
  const dayLabels = language === 'en' 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : language === 'nl'
    ? ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
    : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <AppShell>
      <div className="page-container fade-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1>{t('calendar')} 📅</h1>
            <p>{t('calendar_subtitle')}</p>
          </div>
          {/* Kontrol Bulan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <button className="btn-icon" onClick={handlePrevMonth} style={{ padding: 4 }}>
              <ChevronLeft size={20} />
            </button>
            <strong style={{ minWidth: 120, textAlign: 'center', fontSize: '0.95rem' }}>
              {formatMonthYear(month, year, language)}
            </strong>
            <button className="btn-icon" onClick={handleNextMonth} style={{ padding: 4 }}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Legend Penjelasan Warna */}
        <div className="card" style={{ marginBottom: 20, padding: '12px 20px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} style={{ color: 'var(--color-primary-500)' }} />
              {t('color_guide')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'inline-block' }} /> {t('no_expense_day')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'linear-gradient(135deg, #a7f3d0 0%, #10b981 100%)', display: 'inline-block' }} /> {t('cal_low_desc')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'linear-gradient(135deg, #fef3c7 0%, #f59e0b 100%)', display: 'inline-block' }} /> {t('cal_med_desc')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'linear-gradient(135deg, #fee2e2 0%, #ef4444 100%)', display: 'inline-block' }} /> {t('cal_high_desc')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.95rem' }}>💰</span> {t('has_income_day')}
            </span>
          </div>
        </div>

        {/* Main Grid: Calendar & Day Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }} className="calendar-layout-grid">
          {/* Box Kalender */}
          <div className="card" style={{ padding: 20 }}>
            {loading ? (
              <div className="loading-container" style={{ padding: '60px 0' }}>
                <div className="spinner" />
                <p>{t('loading')}</p>
              </div>
            ) : (
              <div className="calendar-grid-wrapper">
                {/* Header Hari */}
                <div className="calendar-days-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12, textAlign: 'center' }}>
                  {dayLabels.map((lbl, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', paddingBottom: 6 }}>
                      {lbl}
                    </div>
                  ))}
                </div>

                {/* Grid Tanggal */}
                <div className="calendar-dates-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {/* Sel Kosong Awal */}
                  {Array(firstDayIndex).fill(null).map((_, idx) => (
                    <div key={`blank-${idx}`} style={{ minHeight: 76, borderRadius: 12, background: 'transparent' }} />
                  ))}

                  {/* Hari di Bulan */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const stats = dayStats[day]
                    const hasIncome = stats.incomes > 0
                    const isSelected = selectedDay === day
                    const intensity = getIntensityClass(stats.expenses)

                    return (
                      <div
                        key={`day-${day}`}
                        onClick={() => setSelectedDay(day)}
                        className={`calendar-day-cell ${intensity} ${isSelected ? 'selected' : ''}`}
                        style={{
                          minHeight: 76,
                          borderRadius: 12,
                          padding: 8,
                          position: 'relative',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                          border: isSelected ? '2.5px solid var(--color-primary-600)' : '1px solid var(--border-color)'
                        }}
                      >
                        {/* Angka Tanggal + Indikator Kas Masuk */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.8 }}>
                            {day}
                          </span>
                          {hasIncome && (
                            <span style={{ fontSize: '0.8rem', cursor: 'help' }} title={`Ada kas masuk: ${formatRupiah(stats.incomes)}`}>
                              💰
                            </span>
                          )}
                        </div>

                        {/* Pengeluaran Hari Ini */}
                        {stats.expenses > 0 && (
                          <div
                            className="cal-day-expense-label"
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {formatRupiah(stats.expenses).replace(',00', '').replace('Rp ', '')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Panel Rincian Hari */}
          <div className="card" style={{ padding: 20, minHeight: 320 }}>
            {selectedDay ? (
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 16 }}>
                  <CalendarIcon size={18} style={{ color: 'var(--color-primary-600)' }} />
                  <h3 className="card-title" style={{ margin: 0 }}>
                    {t('date_details')} {selectedDay}
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {/* Rekap Saldo Hari Ini */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 10 }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t('income_title')}</div>
                      <strong style={{ color: 'var(--color-success)', fontSize: '0.95rem' }}>
                        {formatRupiah(selectedDayData?.incomes || 0)}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t('total_expense').split(' ')[1] || t('total_expense')}</div>
                      <strong style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                        {formatRupiah(selectedDayData?.expenses || 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Daftar Transaksi */}
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {t('transaction_list')} ({selectedDayData?.items?.length || 0})
                </h4>

                {selectedDayData?.items?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                    {selectedDayData.items.map(tx => {
                      const isIncome = tx.category === 'pemasukan'
                      const info = getCategoryInfo(tx.category)
                      return (
                        <div
                          key={tx.id}
                          style={{
                            padding: '10px 12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 10,
                            borderLeft: `4px solid ${isIncome ? 'var(--color-success)' : info.color}`,
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.itemName}</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              <span>{info.emoji} {t(info.labelKey)}</span>
                              <span>•</span>
                              <span>👤 {tx.member?.name || '-'}</span>
                            </div>
                            {tx.notes && (
                              <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 2 }}>
                                * {tx.notes}
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, color: isIncome ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {isIncome ? '+' : '-'}{formatRupiah(tx.amount)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t('no_transactions_date')}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 250, color: 'var(--text-muted)' }}>
                <CalendarIcon size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                  {t('click_date_prompt')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS internal khusus untuk Kalender agar performa cepat & tampilan rapi */}
      <style jsx global>{`
        .calendar-layout-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .calendar-day-cell {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
        }

        /* Intensitas warna hemat (hijau) */
        .calendar-day-cell.cal-low {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.2) 100%);
          color: #065f46;
        }
        [data-theme="dark"] .calendar-day-cell.cal-low {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.3) 100%);
          color: #a7f3d0;
        }

        /* Intensitas warna wajar (oranye) */
        .calendar-day-cell.cal-medium {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.25) 100%);
          color: #92400e;
        }
        [data-theme="dark"] .calendar-day-cell.cal-medium {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.35) 100%);
          color: #fde68a;
        }

        /* Intensitas warna boros (merah) */
        .calendar-day-cell.cal-high {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.25) 100%);
          color: #991b1b;
        }
        [data-theme="dark"] .calendar-day-cell.cal-high {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.4) 100%);
          color: #fecaca;
        }

        .calendar-day-cell:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: var(--color-primary-400) !important;
        }

        .calendar-day-cell.selected {
          transform: scale(1.02);
          box-shadow: 0 4px 14px rgba(13, 148, 136, 0.25);
        }

        .cal-day-expense-label {
          background: rgba(0, 0, 0, 0.06);
          padding: 2px 4px;
          border-radius: 4px;
          color: inherit;
        }
        [data-theme="dark"] .cal-day-expense-label {
          background: rgba(255, 255, 255, 0.08);
        }

        @media (max-width: 900px) {
          .calendar-layout-grid {
            grid-template-columns: 1fr;
          }
          .calendar-day-cell {
            min-height: 64px !important;
          }
        }
      `}</style>
    </AppShell>
  )
}
