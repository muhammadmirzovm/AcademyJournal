import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, Plus, LogIn, ArrowRight } from 'lucide-react'
import { getGroups } from '../api/groups'
import { useAuth } from '../context/AuthContext'
import { CardSkeleton } from '../components/ui/Skeleton'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isTeacher = user?.role === 'teacher'
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGroups().then(r => setGroups(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {t('dashboard.welcome', { name: user?.first_name || user?.username })}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {isTeacher ? t('dashboard.teacher_sub') : t('dashboard.student_sub')}
        </p>
      </div>

      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard icon={Users}    label={t('dashboard.groups_label')} value={loading ? '…' : groups.length} color="var(--accent)" />
        <StatCard icon={BookOpen} label={t('dashboard.role_label')}   value={isTeacher ? t('dashboard.role_teacher') : t('dashboard.role_student')} color="var(--warning)" />
      </div>

      <div className="fade-up-3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{t('dashboard.my_groups')}</h3>
          <Link to="/groups" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {t('dashboard.view_all')} <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {[0,1,2].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : groups.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              {isTeacher ? t('dashboard.no_groups_teacher') : t('dashboard.no_groups_student')}
            </p>
            <Link to="/groups" style={primaryBtn}>
              {isTeacher ? <><Plus size={14} /> {t('dashboard.create_group')}</> : <><LogIn size={14} /> {t('dashboard.join_group')}</>}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {groups.slice(0, 4).map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                whileHover={{ y: -2 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ height: 4, background: 'var(--accent)' }} />
                <div style={{ padding: '16px 18px' }}>
                  <Link to={`/groups/${g.id}`} style={{ fontWeight: 700, fontSize: 14, textDecoration: 'none', color: 'var(--text)', display: 'block', marginBottom: 6 }}>{g.name}</Link>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} /> {g.member_count} {t('dashboard.students')}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
