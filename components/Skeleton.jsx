'use client'
// components/Skeleton.jsx - Komponen Skeleton Shimmer (pengganti teks "Loading..." / spinner)

export function Skeleton({ width = '100%', height = 16, radius = 8, style = {}, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function AppShellSkeleton() {
  return (
    <div className="app-layout" aria-busy="true" aria-label="Memuat aplikasi">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width={38} height={38} radius={10} />
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <Skeleton width="72%" height={14} radius={6} />
              <Skeleton width="48%" height={10} radius={5} />
            </div>
          </div>
        </div>
        <div className="sidebar-nav" style={{ display: 'grid', gap: 8, alignContent: 'start', paddingTop: 20 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={38} radius={8} />
          ))}
        </div>
        <div className="sidebar-footer">
          <Skeleton width="100%" height={54} radius={10} />
        </div>
      </aside>
      <main className="main-content">
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton width={180} height={26} radius={8} />
              <Skeleton width={240} height={14} radius={6} />
            </div>
            <Skeleton width={160} height={38} radius={10} />
          </div>
          <DashboardSkeleton />
        </div>
      </main>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="summary-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="summary-card skeleton-card-shell">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Skeleton width={96} height={12} radius={5} />
              <Skeleton width={34} height={34} radius={9} />
            </div>
            <Skeleton width="76%" height={26} radius={7} style={{ marginBottom: 12 }} />
            <Skeleton width="52%" height={12} radius={5} />
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="card chart-full">
          <div className="card-header">
            <Skeleton width={200} height={16} radius={6} />
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 200, paddingTop: 20 }}>
              {[38, 62, 28, 84, 48, 72, 34, 92, 55, 40, 68, 76, 44, 58].map((h, idx) => (
                <Skeleton key={idx} width="100%" height={`${h}%`} radius={6} />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Skeleton width={140} height={16} radius={6} />
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '28px 24px' }}>
            <Skeleton width={170} height={170} radius={999} />
            <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
              <Skeleton width={70} height={12} radius={5} />
              <Skeleton width={70} height={12} radius={5} />
              <Skeleton width={70} height={12} radius={5} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Skeleton width={150} height={16} radius={6} />
          </div>
          <div className="card-body">
            <Skeleton width="100%" height={224} radius={10} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <Skeleton width={160} height={16} radius={6} />
          <Skeleton width={90} height={28} radius={7} />
        </div>
        <TableSkeleton rows={5} />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div style={{ padding: '12px 20px', display: 'grid', gap: 12 }} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(80px, 14%) 1fr minmax(90px, 18%) minmax(90px, 16%)',
            gap: 14,
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: i === rows - 1 ? 'none' : '1px solid var(--border-color)',
          }}
        >
          <Skeleton width="78%" height={13} radius={5} />
          <div style={{ display: 'grid', gap: 6 }}>
            <Skeleton width={`${58 + ((i * 13) % 30)}%`} height={14} radius={5} />
            <Skeleton width="36%" height={10} radius={5} />
          </div>
          <Skeleton width={88} height={22} radius={99} />
          <Skeleton width="84%" height={15} radius={5} style={{ justifySelf: 'end' }} />
        </div>
      ))}
    </div>
  )
}

export function LaporanSkeleton() {
  return (
    <div aria-busy="true">
      <div className="summary-grid summary-grid-3" style={{ marginBottom: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="summary-card skeleton-card-shell">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Skeleton width={110} height={12} radius={5} />
              <Skeleton width={32} height={32} radius={9} />
            </div>
            <Skeleton width="72%" height={24} radius={7} style={{ marginBottom: 10 }} />
            <Skeleton width="48%" height={12} radius={5} />
          </div>
        ))}
      </div>
      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><Skeleton width={160} height={16} radius={6} /></div>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width={130} height={12} radius={5} />
                  <Skeleton width={80} height={12} radius={5} />
                </div>
                <Skeleton width="100%" height={7} radius={99} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><Skeleton width={160} height={16} radius={6} /></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '32px 24px' }}>
            <Skeleton width={190} height={190} radius={999} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><Skeleton width={140} height={16} radius={6} /></div>
        <TableSkeleton rows={5} />
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div aria-busy="true">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} width="60%" height={12} radius={5} style={{ margin: '0 auto' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={68} radius={10} />
        ))}
      </div>
    </div>
  )
}

export function SettingsBlockSkeleton({ rows = 4 }) {
  return (
    <div style={{ display: 'grid', gap: 14, padding: '8px 0' }} aria-busy="true">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={76} radius={12} />
        ))}
      </div>
      <TableSkeleton rows={rows} />
    </div>
  )
}
