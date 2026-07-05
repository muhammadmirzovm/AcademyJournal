import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, ChevronRight } from 'lucide-react'

const COLORS = ['#0D9488', '#0891B2', '#7C3AED', '#DB2777', '#D97706', '#059669', '#DC2626', '#6366F1']

export default function TodayLessons({ schedule }) {
  const { t, i18n } = useTranslation()
  const todayIdx = (new Date().getDay() + 6) % 7   // Mon=0 … Sun=6

  const today = (schedule || [])
    .map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }))
    .filter(s => Array.isArray(s.class_days) && s.class_days.includes(todayIdx))

  if (today.length === 0) return null

  const dateLabel = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarClock size={17} color="var(--accent)" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{t('profile.today_lessons')}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', borderRadius: 8, padding: '3px 10px' }}>
          {today.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {today.map(s => (
          <Link key={s.id} to={`/groups/${s.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', textDecoration: 'none', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.group}</span>
            {s.class_time && (
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {s.class_time.replace('-', '–')}
              </span>
            )}
            <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </motion.div>
  )
}
