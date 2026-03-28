'use client'
// app/pengaturan/page.jsx - Halaman Pengaturan (Khusus Admin)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell, { useUser } from '@/components/AppShell'
import { formatRupiah, formatNumber } from '@/lib/format'
import { AVATAR_COLORS } from '@/lib/constants'
import { Settings, Users, Wallet, Check, AlertCircle, Edit2, Trash2, PlusCircle, Shield } from 'lucide-react'

function PengaturanContent() {
  const router = useRouter()
  const { user, familyName, setFamilyName } = useUser()
  const [activeTab, setActiveTab] = useState('budget')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Budget state
  const now = new Date()
  const [currentMonth] = useState(now.getMonth() + 1)
  const [currentYear] = useState(now.getFullYear())
  const [budgetAmount, setBudgetAmount] = useState('')

  // Members state
  const [members, setMembers] = useState([])
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [memberForm, setMemberForm] = useState({ name: '', pin: '', role: 'member', avatarColor: AVATAR_COLORS[0].value })

  // Settings state
  const [formFamilyName, setFormFamilyName] = useState('')

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData()
    }
  }, [user, currentMonth, currentYear])

  async function fetchData() {
    setLoading(true)
    try {
      const [b, M, s] = await Promise.all([
        fetch(`/api/budget?month=${currentMonth}&year=${currentYear}`).then(r => r.json()),
        fetch('/api/members').then(r => r.json()),
        fetch('/api/settings').then(r => r.json())
      ])
      
      if (b.budget) setBudgetAmount(String(b.budget.amount))
      if (M.members) setMembers(M.members)
      if (s.settings?.familyName) setFormFamilyName(s.settings.familyName)
    } catch {}
    setLoading(false)
  }

  function showMessage(type, text) {
    if (type === 'success') {
      setSuccessMsg(text)
      setErrorMsg('')
    } else {
      setErrorMsg(text)
      setSuccessMsg('')
    }
    setTimeout(() => {
      setSuccessMsg('')
      setErrorMsg('')
    }, 3000)
  }

  // --- Budget Handlers ---
  async function handleSaveBudget(e) {
    e.preventDefault()
    if (!budgetAmount || Number(budgetAmount) <= 0) {
      showMessage('error', 'Jumlah kas harus lebih dari 0')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          amount: parseInt(budgetAmount)
        })
      })
      if (res.ok) {
        showMessage('success', 'Kas bulanan berhasil disimpan')
      } else {
        showMessage('error', 'Gagal menyimpan kas')
      }
    } catch {
      showMessage('error', 'Koneksi gagal')
    }
    setLoading(false)
  }

  // --- Member Handlers ---
  function openAddMember() {
    setEditMember(null)
    setMemberForm({ name: '', pin: '', role: 'member', avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].value })
    setShowMemberModal(true)
  }

  function openEditMember(m) {
    setEditMember(m)
    setMemberForm({ name: m.name, pin: '', role: m.role, avatarColor: m.avatarColor || AVATAR_COLORS[0].value })
    setShowMemberModal(true)
  }

  async function handleSaveMember(e) {
    e.preventDefault()
    if (!memberForm.name.trim()) return showMessage('error', 'Nama wajib diisi')
    if (!editMember && !memberForm.pin) return showMessage('error', 'PIN wajib diisi untuk anggota baru')

    setLoading(true)
    try {
      const url = editMember ? `/api/members/${editMember.id}` : '/api/members'
      const method = editMember ? 'PUT' : 'POST'
      
      // Jangan kirim PIN kosong saat edit
      const data = { ...memberForm }
      if (editMember && !data.pin) delete data.pin

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setShowMemberModal(false)
        fetchData()
        showMessage('success', `Anggota berhasil ${editMember ? 'diperbarui' : 'ditambahkan'}`)
      } else {
        const d = await res.json()
        showMessage('error', d.error || 'Gagal menyimpan anggota')
      }
    } catch {
      showMessage('error', 'Koneksi gagal')
    }
    setLoading(false)
  }

  async function handleToggleMemberActive(id, currentStatus) {
    if (id === user.id && currentStatus) {
      return showMessage('error', 'Tidak bisa menonaktifkan akun sendiri')
    }

    if(confirm(`Yakin ingin ${currentStatus ? 'menonaktifkan' : 'mengaktifkan'} anggota ini?`)) {
      setLoading(true)
      try {
        const res = await fetch(`/api/members/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !currentStatus })
        })
        if (res.ok) {
          fetchData()
          showMessage('success', `Status anggota diperbarui`)
        } else {
          showMessage('error', 'Gagal update status')
        }
      } catch {
        showMessage('error', 'Koneksi gagal')
      }
      setLoading(false)
    }
  }

  // --- App Settings Handlers ---
  async function handleSaveSettings(e) {
    e.preventDefault()
    if (!formFamilyName.trim()) return showMessage('error', 'Nama keluarga wajib diisi')

    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyName: formFamilyName })
      })
      if (res.ok) {
        setFamilyName(formFamilyName)
        showMessage('success', 'Pengaturan aplikasi diperbarui')
      }
    } catch {
      showMessage('error', 'Koneksi gagal')
    }
    setLoading(false)
  }

  if (!user || user.role !== 'admin') return null

  return (
    <>
      <div className="page-container">
        <div className="page-header">
           <h1>Pengaturan ⚙️</h1>
           <p>Kelola kas bulanan, anggota keluarga, dan preferensi aplikasi</p>
        </div>

        {/* Global Messages */}
        {successMsg && (
          <div className="alert alert-success">
            <Check size={16} /> <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-danger">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Tabs Sidebar */}
          <div className="card" style={{ flex: '1', minWidth: 250, alignSelf: 'stretch' }}>
            <div className="card-body" style={{ padding: '16px 0' }}>
              <div 
                className={`nav-link ${activeTab === 'budget' ? 'active' : ''}`}
                onClick={() => setActiveTab('budget')}
                style={{ padding: '12px 24px', borderRadius: 0, borderLeft: activeTab === 'budget' ? '3px solid var(--color-primary-600)' : '3px solid transparent' }}
              >
                <Wallet size={18} /> Kas Bulanan
              </div>
              <div 
                className={`nav-link ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => setActiveTab('members')}
                style={{ padding: '12px 24px', borderRadius: 0, borderLeft: activeTab === 'members' ? '3px solid var(--color-primary-600)' : '3px solid transparent' }}
              >
                <Users size={18} /> Anggota Keluarga
              </div>
              <div 
                className={`nav-link ${activeTab === 'app' ? 'active' : ''}`}
                onClick={() => setActiveTab('app')}
                style={{ padding: '12px 24px', borderRadius: 0, borderLeft: activeTab === 'app' ? '3px solid var(--color-primary-600)' : '3px solid transparent' }}
              >
                <Settings size={18} /> Preferensi Aplikasi
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ flex: '3', minWidth: 300 }}>
            {activeTab === 'budget' && (
              <div className="card fade-in-up">
                <div className="card-header">
                  <h3 className="card-title">Pengaturan Kas Bulanan</h3>
                </div>
                <div className="card-body">
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
                    Tetapkan batasan pengeluaran atau total uang yang dikumpulkan keluarga bulan ini.
                    Bulan aktif: <strong>Bulan ke-{currentMonth} Tahun {currentYear}</strong>
                  </p>
                  
                  <form onSubmit={handleSaveBudget} style={{ maxWidth: 400 }}>
                    <div className="form-group">
                      <label className="form-label">Total Kas Bulan Ini (Rp)</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>Rp</div>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          style={{ paddingLeft: 40 }}
                          placeholder="0"
                          value={budgetAmount ? formatNumber(parseInt(budgetAmount)) : ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setBudgetAmount(raw)
                          }}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan Kas'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="card fade-in-up">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3 className="card-title">Anggota Keluarga ({members.filter(m => m.isActive).length}/5)</h3>
                  <button className="btn btn-primary btn-sm" onClick={openAddMember} disabled={members.filter(m => m.isActive).length >= 5}>
                    <PlusCircle size={15} /> Tambah
                  </button>
                </div>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} style={{ opacity: m.isActive ? 1 : 0.6 }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.8rem' }}>
                                {m.name.substring(0,2).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 500 }}>{m.name}</span>
                              {m.id === user.id && <span className="badge badge-gray mx-2" style={{marginLeft: 8}}>Anda</span>}
                            </div>
                          </td>
                          <td>
                             {m.role === 'admin' ? 
                              <span className="badge badge-purple"><Shield size={12}/> Admin</span> : 
                              <span className="badge badge-blue">Member</span>
                             }
                          </td>
                          <td>
                            {m.isActive ? <span className="text-success text-sm font-medium">Aktif</span> : <span className="text-danger text-sm font-medium">Nonaktif</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-icon" onClick={() => openEditMember(m)} title="Edit"><Edit2 size={16}/></button>
                              <button 
                                className="btn-icon" 
                                onClick={() => handleToggleMemberActive(m.id, m.isActive)}
                                disabled={m.id === user.id}
                                title={m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                style={{ color: m.isActive ? 'var(--color-danger)' : 'var(--color-success)' }}
                              >
                                {m.isActive ? <Trash2 size={16}/> : <Check size={16}/>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'app' && (
              <div className="card fade-in-up">
                <div className="card-header">
                  <h3 className="card-title">Preferensi Aplikasi</h3>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSaveSettings} style={{ maxWidth: 400 }}>
                    <div className="form-group">
                      <label className="form-label">Nama Keluarga / Judul Aplikasi</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formFamilyName}
                        onChange={e => setFormFamilyName(e.target.value)}
                        placeholder="Contoh: Keluarga Cemara"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Anggota */}
      {showMemberModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editMember ? 'Edit Anggota' : 'Tambah Anggota'}</h3>
              <button className="btn-icon" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveMember}>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nama Panggilan</label>
                  <input
                    type="text"
                    className="form-input"
                    value={memberForm.name}
                    onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Ayah, Ibu..."
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">PIN Login (4-6 digit angka)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    className="form-input"
                    value={memberForm.pin}
                    onChange={e => setMemberForm(f => ({ ...f, pin: e.target.value }))}
                    placeholder={editMember ? '(Kosongkan jika tidak ingin mengubah)' : 'Misal: 1234'}
                    required={!editMember}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Peran (Role)</label>
                    <select
                      className="form-select"
                      value={memberForm.role}
                      onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))}
                      disabled={editMember?.id === user.id} // Tidak bisa edit role sendiri
                    >
                      <option value="admin">Admin (Akses Penuh)</option>
                      <option value="member">Member (Hanya Input & Riwayat)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Warna Avatar</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {AVATAR_COLORS.map(color => (
                        <div
                          key={color.value}
                          onClick={() => setMemberForm(f => ({ ...f, avatarColor: color.value }))}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', background: color.value,
                            cursor: 'pointer', border: memberForm.avatarColor === color.value ? '3px solid var(--border-focus)' : '2px solid transparent',
                            transform: memberForm.avatarColor === color.value ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s'
                          }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : '✅ Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  )
}

export default function PengaturanPage() {
  return (
    <AppShell>
      <PengaturanContent />
    </AppShell>
  )
}
