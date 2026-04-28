import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 13, maxWidth: 200 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 11 }}>{d.date}</p>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text)', wordBreak: 'break-word' }}>{d.fullName}</p>
      <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 18 }}>
        {payload[0].value}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}> / 5</span>
      </p>
    </div>
  )
}

function shortDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ScoreLineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No score data yet
      </div>
    )
  }

  const chartData = data.map(d => ({
    label: shortDate(d.date),
    score: d.score,
    fullName: d.lesson,
    date: d.date,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 5]} ticks={[0,1,2,3,4,5]}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={3} stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5} />
        <Line
          type="monotone" dataKey="score"
          stroke="var(--accent)" strokeWidth={2.5}
          dot={{ fill: 'var(--accent)', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
