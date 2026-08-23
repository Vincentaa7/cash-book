'use client'
// app/laporan/page.jsx - Laporan & Rekap Keuangan

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@/components/UserContext'
import CategoryBadge from '@/components/CategoryBadge'
import { formatRupiah, formatDate, formatMonthYear, calcPercentage, formatNumber } from '@/lib/format'
import { CATEGORIES, getCategoryInfo } from '@/lib/constants'
import { Download, FileText, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

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
  const [compareData, setCompareData] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(d.members || []))
  }, [])

  async function fetchSummaryForMonth(m, y) {
    try {
      const res = await fetch(`/api/dashboard?month=${m}&year=${y}&summaryOnly=true`)
      const d = await res.json()
      setDashboardSummary(d.summary)
    } catch {}
  }

  async function fetchComparison(m, y) {
    try {
      const res = await fetch(`/api/laporan/compare?month=${m}&year=${y}`)
      const d = await res.json()
      setCompareData(d)
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
          fetchComparison(month, year)
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

  async function handleExportPDF() {
    try {
      // Dynamic import agar tidak mempengaruhi bundle size saat halaman pertama dimuat
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()

      // === KOP SURAT ===
      doc.setFillColor(13, 148, 136)
      doc.rect(0, 0, pageW, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('LAPORAN KEUANGAN KELUARGA', pageW / 2, 11, { align: 'center' })
      doc.setFontSize(11)
      doc.text(`Buku Kas: ${familyName || ''}`, pageW / 2, 19, { align: 'center' })
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Dicetak: ${now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}`, pageW / 2, 25, { align: 'center' })

      // === PERIODE ===
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 36)
      doc.setDrawColor(13, 148, 136)
      doc.setLineWidth(0.5)
      doc.line(14, 38, pageW - 14, 38)

      let curY = 44

      // === RINGKASAN ANGGARAN ===
      if (dashboardSummary) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text('I. RINGKASAN ANGGARAN KAS', 14, curY)
        curY += 4
        autoTable(doc, {
          startY: curY,
          head: [['Parameter', 'Nominal']],
          body: [
            ['Total Anggaran', formatRupiah(dashboardSummary.totalBudget)],
            ['Total Pengeluaran', formatRupiah(dashboardSummary.totalExpense)],
            ['Sisa Anggaran', formatRupiah(dashboardSummary.remaining)],
            ['Persentase Terpakai', `${dashboardSummary.budgetPercentUsed}%`],
          ],
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 14, right: 14 },
          theme: 'striped',
        })
        curY = doc.lastAutoTable.finalY + 8
      }

      // === BREAKDOWN KATEGORI ===
      if (catBreakdown.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text('II. BREAKDOWN KATEGORI PENGELUARAN', 14, curY)
        curY += 4
        autoTable(doc, {
          startY: curY,
          head: [['Kategori', 'Total', '%']],
          body: catBreakdown.map(({ category: cat, amount }) => {
            const info = getCategoryInfo(cat)
            const pct = calcPercentage(amount, totalExpense)
            return [`${info.emoji} ${cat}`, formatRupiah(amount), `${pct}%`]
          }),
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
          margin: { left: 14, right: 14 },
          theme: 'striped',
        })
        curY = doc.lastAutoTable.finalY + 8
      }

      // === TABEL TRANSAKSI ===
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`III. DAFTAR TRANSAKSI (${transactions.length} transaksi)`, 14, curY)
      curY += 4
      autoTable(doc, {
        startY: curY,
        head: [['Tanggal', 'Item / Keperluan', 'Kategori', 'Anggota', 'Jumlah']],
        body: transactions.map(tx => [
          formatDate(tx.transactionDate, 'id'),
          tx.itemName + (tx.notes ? `\n(${tx.notes})` : ''),
          tx.category,
          tx.member?.name || '-',
          formatRupiah(tx.amount),
        ]),
        foot: [['', '', '', 'TOTAL', formatRupiah(totalExpense)]],
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          4: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        theme: 'striped',
      })

      // === FOOTER TANDA TANGAN ===
      const finalY = doc.lastAutoTable.finalY + 14
      const pageH = doc.internal.pageSize.getHeight()
      const sigY = Math.min(finalY, pageH - 40)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text('Dilaporkan Oleh,', 14, sigY + 4)
      doc.line(14, sigY + 22, 70, sigY + 22)
      doc.text('Admin / Pengelola Kas', 14, sigY + 26)
      doc.text('Disetujui Oleh,', pageW - 70, sigY + 4)
      doc.line(pageW - 70, sigY + 22, pageW - 14, sigY + 22)
      doc.text('Kepala Keluarga', pageW - 70, sigY + 26)

      // Simpan PDF
      const fileName = `laporan-keuangan-${startDate}-${endDate}.pdf`
      doc.save(fileName)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Gagal membuat PDF. Silakan coba lagi.')
    }
  }

  function handlePrint() {
    window.print()
  }

  const transactions = data?.transactions || []
  const expenseTransactions = transactions.filter(t => t.category !== 'pemasukan')
  const totalExpense = expenseTransactions.reduce((s, t) => s + Number(t.amount), 0)

  // 1. Rata-rata per transaksi [NEW]
  const avgTxAmount = expenseTransactions.length > 0 ? Math.round(totalExpense / expenseTransactions.length) : 0

  // 2. Hari Terboros (Peak Day) [NEW]
  const dayNamesID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const dayNamesEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayNamesNL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

  const dayExpenses = Array(7).fill(0)
  expenseTransactions.forEach(t => {
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
  expenseTransactions.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount)
  })
  const catBreakdown = Object.entries(catMap)
    .map(([cat, amt]) => ({ category: cat, amount: amt }))
    .sort((a, b) => b.amount - a.amount)

  // Per anggota
  const memberMap = {}
  expenseTransactions.forEach(t => {
    const n = t.member?.name || 'Tidak diketahui'
    memberMap[n] = (memberMap[n] || 0) + Number(t.amount)
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
        {/* Print-Only: Tata Letak Laporan Formal */}
        <div className="print-only-layout" style={{ display: 'none' }}>
          {/* Kop Surat Resmi */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>
              LAPORAN KEUANGAN KELUARGA
            </h2>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px 0', color: '#1e293b' }}>
              Buku Kas Keluarga: {familyName?.toUpperCase() || ''}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 16px 0' }}>
              Periode: {formatDate(new Date(startDate), language)} s/d {formatDate(new Date(endDate), language)}
            </p>
            <div style={{ borderBottom: '2.5px double #000', marginTop: 8, marginBottom: 24 }} />
          </div>

          {/* I. Ringkasan Anggaran Kas */}
          {dashboardSummary && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 8px 0', textTransform: 'uppercase', borderBottom: '1.5px solid #000', paddingBottom: 4 }}>
                I. RINGKASAN ANGGARAN KAS
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', background: '#f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Parameter Keuangan</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Nominal (Rupiah)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px' }}>Total Alokasi Kas (Budget)</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(dashboardSummary.totalBudget)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px' }}>Total Realisasi Pengeluaran</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatRupiah(dashboardSummary.totalExpense)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #000', fontWeight: 700, background: '#f8fafc' }}>
                    <td style={{ padding: '6px 8px' }}>Sisa Saldo Kas</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: dashboardSummary.remaining >= 0 ? '#16a34a' : '#ef4444' }}>
                      {formatRupiah(dashboardSummary.remaining)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* II. Rincian Pengeluaran per Kategori */}
          <div style={{ marginBottom: 24, breakInside: 'avoid' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 8px 0', textTransform: 'uppercase', borderBottom: '1.5px solid #000', paddingBottom: 4 }}>
              II. RINCIAN PENGELUARAN PER KATEGORI
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', background: '#f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Kategori Pengeluaran</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Total Pengeluaran</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Persentase (%)</th>
                </tr>
              </thead>
              <tbody>
                {catBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '8px', color: '#64748b' }}>Tidak ada pengeluaran pada periode ini.</td>
                  </tr>
                ) : (
                  catBreakdown.map(({ category: cat, amount }) => {
                    const info = getCategoryInfo(cat)
                    return (
                      <tr key={cat} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px 8px' }}>{info.emoji} {t(info.labelKey)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatRupiah(amount)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{calcPercentage(amount, totalExpense)}%</td>
                      </tr>
                    )
                  })
                )}
                <tr style={{ borderBottom: '1px solid #000', fontWeight: 700, background: '#f8fafc' }}>
                  <td style={{ padding: '8px' }}>TOTAL PENGELUARAN</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#ef4444' }}>{formatRupiah(totalExpense)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* III. Daftar Transaksi Rinci */}
          <div style={{ marginBottom: 32 }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 8px 0', textTransform: 'uppercase', borderBottom: '1.5px solid #000', paddingBottom: 4 }}>
              III. DAFTAR TRANSAKSI RINCI
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', background: '#f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '6px 6px', fontWeight: 700, width: '15%' }}>Tanggal</th>
                  <th style={{ textAlign: 'left', padding: '6px 6px', fontWeight: 700, width: '35%' }}>Nama Barang / Keperluan</th>
                  <th style={{ textAlign: 'left', padding: '6px 6px', fontWeight: 700, width: '20%' }}>Kategori</th>
                  <th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 700, width: '18%' }}>Nominal</th>
                  <th style={{ textAlign: 'left', padding: '6px 6px', fontWeight: 700, width: '12%' }}>Pencatat</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '8px', color: '#64748b' }}>Tidak ada transaksi tercatat.</td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '6px 6px', fontSize: '0.75rem' }}>{formatDate(tx.transactionDate, language)}</td>
                      <td style={{ padding: '6px 6px', fontWeight: 500 }}>
                        {tx.itemName}
                        {tx.notes && <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', display: 'block' }}>* {tx.notes}</span>}
                      </td>
                      <td style={{ padding: '6px 6px' }}>{t(getCategoryInfo(tx.category).labelKey)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600, color: tx.category === 'pemasukan' ? '#10b981' : '#ef4444' }}>{formatRupiah(tx.amount)}</td>
                      <td style={{ padding: '6px 6px' }}>{tx.member?.name || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Blok Tanda Tangan */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, breakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <p style={{ margin: '0 0 50px 0', fontSize: '0.85rem' }}>Dilaporkan Oleh,</p>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>Admin / Pengelola Kas</p>
            </div>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <p style={{ margin: '0 0 50px 0', fontSize: '0.85rem' }}>Disetujui Oleh,</p>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>Kepala Keluarga</p>
            </div>
          </div>
        </div>

        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('reports')} 📄</h1>
            <p>{t('digital_cashbook')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <Download size={15} /> {t('actions')} CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportPDF} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none' }}>
              <FileText size={15} /> Export PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
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
              <div className="summary-card card-history">
                <div className="summary-card-icon">📊</div>
                <div className="summary-card-label">{t('history')}</div>
                <div className="summary-card-value">{transactions.length}</div>
                <div className="summary-card-sub">{startDate} s/d {endDate}</div>
              </div>

              {/* Card 2: Total Pengeluaran */}
              <div className="summary-card card-expense">
                <div className="summary-card-icon">💸</div>
                <div className="summary-card-label">{t('total_expense')}</div>
                <div className="summary-card-value">{formatRupiah(totalExpense)}</div>
                <div className="summary-card-sub">{t('digital_cashbook')}</div>
              </div>

              {/* Card 3: Rata-rata per Transaksi */}
              <div className="summary-card card-avg-tx">
                <div className="summary-card-icon">🧮</div>
                <div className="summary-card-label">{t('avg_transaction')}</div>
                <div className="summary-card-value">{formatRupiah(avgTxAmount)}</div>
                <div className="summary-card-sub">Per transaksi dicatat</div>
              </div>

              {/* Card 4: Hari Terboros */}
              <div className="summary-card card-peak-day">
                <div className="summary-card-icon">📅</div>
                <div className="summary-card-label">{t('most_expensive_day')}</div>
                <div className="summary-card-value" style={{ fontSize: '1.45rem' }}>{peakDayName}</div>
                <div className="summary-card-sub">{maxDayExpense > 0 ? `Total: ${formatRupiah(maxDayExpense)}` : 'Belum ada data'}</div>
              </div>

              {/* Card 5: Kategori Terboros */}
              {catBreakdown[0] ? (
                <div className="summary-card card-peak-cat">
                  <div className="summary-card-icon">🏆</div>
                  <div className="summary-card-label">{t('highest_expense')} ({t('category').split(' ')[0]})</div>
                  <div className="summary-card-value" style={{ fontSize: '1.15rem' }}>
                    {getCategoryInfo(catBreakdown[0].category).emoji} {t(getCategoryInfo(catBreakdown[0].category).labelKey)}
                  </div>
                  <div className="summary-card-sub">{formatRupiah(catBreakdown[0].amount)}</div>
                </div>
              ) : (
                <div className="summary-card card-peak-cat">
                  <div className="summary-card-icon">🏆</div>
                  <div className="summary-card-label">{t('highest_expense')}</div>
                  <div className="summary-card-value">-</div>
                  <div className="summary-card-sub">Belum ada data</div>
                </div>
              )}

              {/* Card 6: Anggota Terboros */}
              {memberBreakdown[0] ? (
                <div className="summary-card card-peak-member">
                  <div className="summary-card-icon">👤</div>
                  <div className="summary-card-label">{t('highest_expense')} ({t('member_name').split(' ')[0]})</div>
                  <div className="summary-card-value" style={{ fontSize: '1.3rem' }} title={memberBreakdown[0].name}>{memberBreakdown[0].name}</div>
                  <div className="summary-card-sub">{formatRupiah(memberBreakdown[0].amount)}</div>
                </div>
              ) : (
                <div className="summary-card card-peak-member">
                  <div className="summary-card-icon">👤</div>
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

            {/* Grafik Perbandingan 6 Bulan */}
            {compareData && compareData.history && (
              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <h3 className="card-title">📊 Tren 6 Bulan Terakhir</h3>
                  {/* Summary naik/turun */}
                  {compareData.previous?.amount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem',
                      padding: '4px 12px', borderRadius: 99, fontWeight: 700,
                      background: compareData.changeTrend === 'up'
                        ? 'rgba(239,68,68,0.12)'
                        : compareData.changeTrend === 'down'
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(100,116,139,0.12)',
                      color: compareData.changeTrend === 'up' ? '#ef4444'
                        : compareData.changeTrend === 'down' ? '#10b981' : '#64748b',
                    }}>
                      {compareData.changeTrend === 'up'
                        ? <TrendingUp size={14} />
                        : compareData.changeTrend === 'down'
                        ? <TrendingDown size={14} />
                        : <Minus size={14} />}
                      {Math.abs(compareData.changePercent)}%
                      {compareData.changeTrend === 'up' ? ' lebih boros' : compareData.changeTrend === 'down' ? ' lebih hemat' : ' sama'}
                      {' '}vs bulan lalu
                    </div>
                  )}
                </div>
                <div className="card-body">
                  {/* Summary cards: bulan ini vs bulan lalu vs rata-rata */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 12, borderLeft: '4px solid var(--color-primary-500)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Bulan Ini</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-primary-600)' }}>{formatRupiah(compareData.current?.amount || 0)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {formatMonthYear(compareData.current?.month, compareData.current?.year, language)}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 12, borderLeft: '4px solid #64748b' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Bulan Lalu</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#64748b' }}>{formatRupiah(compareData.previous?.amount || 0)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {formatMonthYear(compareData.previous?.month, compareData.previous?.year, language)}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 12, borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Rata-rata 3 Bln</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#d97706' }}>{formatRupiah(compareData.avg3Months || 0)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>per bulan</div>
                    </div>
                  </div>

                  {/* Bar Chart 6 bulan */}
                  <div style={{ height: 240, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={compareData.history.map((h, idx) => ({
                          name: formatMonthYear(h.month, h.year, language).slice(0, 8),
                          amount: h.amount,
                          isCurrent: idx === 5,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} tickFormatter={v => formatNumber(v)} width={60} />
                        <Tooltip
                          formatter={v => formatRupiah(v)}
                          contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.8rem' }}
                        />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {compareData.history.map((_, idx) => (
                            <Cell key={idx} fill={idx === 5 ? 'var(--color-primary-500)' : idx === 4 ? '#94a3b8' : '#cbd5e1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary-500)', display: 'inline-block' }} />
                      Bulan ini
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8', display: 'inline-block' }} />
                      Bulan lalu
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#cbd5e1', display: 'inline-block' }} />
                      Sebelumnya
                    </span>
                  </div>
                </div>
              </div>
            )}

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
          /* Sembunyikan semua elemen di layar */
          body * {
            visibility: hidden;
          }
          
          /* Hanya tampilkan tata letak print formal */
          .print-only-layout, .print-only-layout * {
            visibility: visible;
          }
          
          .print-only-layout {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }

          /* Hilangkan margin default browser print */
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </AppShell>
  )
}
