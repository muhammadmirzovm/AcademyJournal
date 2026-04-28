import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: payload[0].payload.color }}>{payload[0].name}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{payload[0].value} lessons</p>
    </div>
  )
}

function CenterLabel({ cx, cy, present, total }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: 'var(--text)', fontFamily: 'var(--font-body)' }}>
        {pct}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
        attendance
      </text>
    </g>
  )
}

export default function AttendanceDoughnut({ data }) {
  const present = data?.present ?? 0
  const absent  = data?.absent  ?? 0
  const total   = data?.total   ?? 0

  if (total === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No attendance data yet
      </div>
    )
  }

  const chartData = [
    { name: 'Present', value: present, color: '#059669' },
    { name: 'Absent',  value: absent,  color: '#DC2626' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <ResponsiveContainer width={200} height={220}>
        <PieChart>
          <Pie
            data={chartData} cx="50%" cy="50%"
            innerRadius={68} outerRadius={95}
            paddingAngle={3} dataKey="value"
            animationBegin={0} animationDuration={800}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <CenterLabel cx={100} cy={110} present={present} total={total} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chartData.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 18, lineHeight: 1, color: 'var(--text)' }}>{d.value}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.name}</p>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <p style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{total}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total lessons</p>
        </div>
      </div>
    </div>
  )
}
