import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Users, TrendingUp, CalendarCheck } from 'lucide-react'
import AttendanceDoughnut from './AttendanceDoughnut'

const COLORS = ['#0D9488', '#0891B2', '#7C3AED', '#DB2777', '#D97706', '#059669', '#DC2626', '#6366F1']

export default function AdminCharts({ stats }) {
  const { t, i18n } = useTranslation()
  if (!stats) return null

  const spt    = stats.students_per_teacher || []
  const growth = (stats.students_growth || []).map(g => ({
    ...g,
    label: new Date(`${g.month}-01`).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' }),
  }))
  const att = stats.attendance_summary

  if (spt.length === 0 && growth.length === 0 && !(att && att.total > 0)) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>

      {spt.length > 0 && (
        <div style={card}>
          <div style={titleRow}><Users size={16} color="var(--accent)" /><p style={cardTitle}>{t('admin_stats.students_per_teacher')}</p></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spt} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
              <XAxis dataKey="teacher" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, t('admin_stats.students')]} />
              <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                {spt.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {growth.length > 0 && (
        <div style={card}>
          <div style={titleRow}><TrendingUp size={16} color="var(--accent)" /><p style={cardTitle}>{t('admin_stats.new_students')}</p></div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={growth} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="adminGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, t('admin_stats.students')]} />
              <Area type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2.5} fill="url(#adminGrowth)"
                dot={{ fill: 'var(--accent)', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {att && att.total > 0 && (
        <div style={card}>
          <div style={titleRow}><CalendarCheck size={16} color="var(--accent)" /><p style={cardTitle}>{t('admin_stats.attendance')}</p></div>
          <AttendanceDoughnut data={att} />
        </div>
      )}

    </div>
  )
}

const card        = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-sm)' }
const titleRow    = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }
const cardTitle   = { fontWeight: 700, fontSize: 14, margin: 0 }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }
