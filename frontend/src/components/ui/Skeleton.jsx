export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />
  )
}

export function CardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ height: 5, background: 'var(--border)' }} />
      <div style={{ padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton height={18} width="60%" />
        <Skeleton height={13} width="80%" />
        <Skeleton height={13} width="40%" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        <div className="skeleton" style={{ height: 80 }} />
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ marginTop: -44, marginBottom: 16 }}>
            <Skeleton width={88} height={88} radius="50%" />
          </div>
          <Skeleton height={24} width="40%" style={{ marginBottom: 10 }} />
          <Skeleton height={14} width="25%" style={{ marginBottom: 14 }} />
          <Skeleton height={14} width="90%" style={{ marginBottom: 6 }} />
          <Skeleton height={14} width="75%" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Skeleton height={16} width="50%" style={{ marginBottom: 20 }} />
            <Skeleton height={220} />
          </div>
        ))}
      </div>
    </div>
  )
}
