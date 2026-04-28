import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, LayoutDashboard, Star } from 'lucide-react'

const COLORS = ['#0D9488','#0891B2','#7C3AED','#DB2777','#D97706','#059669','#DC2626','#6366F1']

export default function TeacherStats({ stats }) {
  const { t } = useTranslation()
  if (!stats) return null

  const statCards = [
    { label: t('teacher_stats.total_students'), value: stats.total_students, icon: Users,          color: '#0D9488' },
    { label: t('teacher_stats.groups'),         value: stats.total_groups,   icon: LayoutDashboard, color: '#0891B2' },
    { label: t('teacher_stats.lessons'),        value: stats.total_lessons,  icon: BookOpen,        color: '#7C3AED' },
    { label: t('teacher_stats.avg_score'),      value: stats.avg_score ? `${stats.avg_score}/5` : '—', icon: Star, color: '#D97706' },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {stats.scores_by_group?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>

          {/* Avg score per group */}
          <div style={card}>
            <p style={cardTitle}>{t('teacher_stats.score_by_group')}</p>
            <p style={cardSub}>{t('teacher_stats.score_by_group_sub')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.scores_by_group} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                <XAxis dataKey="group" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v} / 5`, t('teacher_stats.avg_score_tooltip')]}
                />
                <Bar dataKey="avg_score" radius={[6, 6, 0, 0]}>
                  {stats.scores_by_group.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Students per group */}
          <div style={card}>
            <p style={cardTitle}>{t('teacher_stats.students_by_group')}</p>
            <p style={cardSub}>{t('teacher_stats.students_by_group_sub')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.students_by_group} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                <XAxis dataKey="group" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v, t('teacher_stats.students_tooltip')]}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                  {stats.students_by_group.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* Empty state — teacher has no groups yet */}
      {stats.total_groups === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {t('teacher_stats.no_groups')}
        </div>
      )}
    </div>
  )
}

const card      = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }
const cardTitle = { fontWeight: 700, fontSize: 14, marginBottom: 2 }
const cardSub   = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }
