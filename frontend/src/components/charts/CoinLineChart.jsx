import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 13, maxWidth: 200 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 11 }}>{d.date}</p>
      {d.note && <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>{d.note}</p>}
      <p style={{ fontWeight: 700, color: '#F59E0B', fontSize: 16 }}>
        🪙 {d.total}
        {d.amount !== 0 && (
          <span style={{ fontSize: 12, fontWeight: 500, color: d.amount > 0 ? '#10b981' : '#ef4444', marginLeft: 6 }}>
            {d.amount > 0 ? `+${d.amount}` : d.amount}
          </span>
        )}
      </p>
    </div>
  )
}

function shortDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function CoinLineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No coin data yet
      </div>
    )
  }

  const chartData = data.map(d => ({
    label:  shortDate(d.date),
    total:  d.total,
    amount: d.amount,
    note:   d.note,
    date:   d.date,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false} tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone" dataKey="total"
          stroke="#F59E0B" strokeWidth={2.5}
          fill="url(#coinGrad)"
          dot={{ fill: '#F59E0B', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: '#F59E0B', stroke: 'var(--surface)', strokeWidth: 2 }}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
