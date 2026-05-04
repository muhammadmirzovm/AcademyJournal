import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap, BookOpen, Users, Shield, Heart,
  Edit2, Save, X, Loader2, TrendingUp, CalendarCheck, Star, Trophy,
} from 'lucide-react'
import { getProfile, getUserStats, updateMe, getUserChildren } from '../api/users'
import { getGroups } from '../api/groups'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ScoreLineChart from '../components/charts/ScoreLineChart'
import AttendanceDoughnut from '../components/charts/AttendanceDoughnut'
import TeacherStats from '../components/charts/TeacherStats'
import { ProfileSkeleton } from '../components/ui/Skeleton'

export default function Profile() {
  const { id } = useParams()
  const { user: me, setUser } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isOwn = String(me?.id) === String(id)

  const [profile,  setProfile]  = useState(null)
  const [stats,    setStats]    = useState(null)
  const [groups,   setGroups]   = useState([])
  const [children, setChildren] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editing, setEditing] = useState(false)
  const [bio, setBio]         = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setEditing(false)
    Promise.all([
      getProfile(id),
      getUserStats(id),
      isOwn ? getGroups() : Promise.resolve({ data: [] }),
    ]).then(([p, s, g]) => {
      const targetRole    = p.data.role
      const viewerRole    = me?.role
      const viewerIsOwner = String(me?.id) === String(id)
      if (
        (targetRole === 'admin' || targetRole === 'teacher') &&
        viewerRole !== 'admin' && viewerRole !== 'teacher' &&
        !viewerIsOwner
      ) {
        navigate('/dashboard', { replace: true })
        return
      }
      setProfile(p.data)
      setBio(p.data.bio || '')
      setStats(s.data)
      setGroups(g.data)
      if (p.data.role === 'parent') {
        getUserChildren(id).then(r => setChildren(r.data)).catch(() => {})
      }
    }).catch(() => show(t('profile.fail_load'), 'error'))
    .finally(() => setLoading(false))
  }, [id])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { data } = await updateMe({ bio })
      setProfile(p => ({ ...p, ...data }))
      setUser(u => ({ ...u, ...data }))
      setEditing(false)
      show(t('profile.toast_updated'), 'success')
    } catch { show(t('profile.fail_update'), 'error') }
    finally { setSaving(false) }
  }

  const cancelEdit = () => {
    setEditing(false)
    setBio(profile?.bio || '')
  }

  if (loading) return <ProfileSkeleton />
  if (!profile) return <p style={{ color: 'var(--text-muted)' }}>{t('profile.not_found')}</p>

  const initials = (profile.first_name?.[0] || profile.username?.[0] || '?').toUpperCase()
  const avgScore = stats?.score_trend?.length
    ? (stats.score_trend.reduce((a, b) => a + b.score, 0) / stats.score_trend.length).toFixed(1)
    : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Profile hero card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>

        {/* Top accent bar */}
        <div style={{ height: 80, background: 'linear-gradient(135deg, var(--accent) 0%, #0f766e 100%)' }} />

        <div className="profile-hero-body" style={{ padding: '0 28px 28px', position: 'relative' }}>
          {/* Avatar initials */}
          <div style={{ position: 'relative', display: 'inline-block', marginTop: -44, marginBottom: 16 }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', border: '4px solid var(--surface)', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{initials}</span>
            </div>
          </div>

          {/* Name + role + edit controls */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                {profile.first_name} {profile.last_name}
                {!profile.first_name && !profile.last_name && profile.username}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>@{profile.username}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <RoleBadge role={profile.role} />
                {avgScore && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 99, padding: '3px 10px' }}>
                    <TrendingUp size={12} /> {t('profile.avg_score', { score: avgScore })}
                  </span>
                )}
              </div>
            </div>

            {isOwn && (
              <div style={{ display: 'flex', gap: 8 }}>
                {editing ? (
                  <>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={saveProfile} disabled={saving}
                      style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                      {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={13} />}
                      {saving ? t('profile.saving') : t('profile.save')}
                    </motion.button>
                    <button onClick={cancelEdit} style={ghostBtn}><X size={13} /> {t('profile.cancel')}</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={ghostBtn}><Edit2 size={13} /> {t('profile.edit')}</button>
                )}
              </div>
            )}
          </div>

          {/* Bio */}
          <div style={{ marginTop: 16 }}>
            {editing ? (
              <textarea
                value={bio} onChange={e => setBio(e.target.value)}
                placeholder={t('profile.bio_placeholder')} rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              />
            ) : profile.bio ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{profile.bio}</p>
            ) : isOwn ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('profile.no_bio')}</p>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Stats section — role-specific */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        style={{ marginBottom: 24 }}>
        {profile.role === 'admin' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <ProfileStatCard icon={Users}        label={t('dashboard.total_students')} value={stats?.total_students ?? '…'} color="#14B8A8" />
            <ProfileStatCard icon={GraduationCap} label={t('dashboard.total_teachers')} value={stats?.total_teachers ?? '…'} color="#8B5CF6" />
            <ProfileStatCard icon={BookOpen}     label={t('dashboard.total_groups')}   value={stats?.total_groups   ?? '…'} color="#0891B2" />
            <ProfileStatCard icon={Trophy}       label={t('dashboard.total_lessons')}  value={stats?.total_lessons  ?? '…'} color="#F59E0B" />
          </div>
        ) : profile.role === 'teacher' ? (
          <TeacherStats stats={stats} />
        ) : profile.role === 'parent' ? (
          <div style={chartCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ ...chartIconWrap, background: 'rgba(236,72,153,0.1)' }}>
                <Heart size={16} color="#EC4899" />
              </div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.linked_children')}</p>
            </div>
            {children.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.no_children')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {children.map(child => (
                  <Link key={child.id} to={`/profile/${child.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#EC4899'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,184,168,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={16} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.display_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{child.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div style={chartCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={chartIconWrap}><TrendingUp size={16} color="var(--accent)" /></div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.score_trend')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.lessons_scored', { count: stats?.score_trend?.length || 0 })}</p>
                </div>
              </div>
              <ScoreLineChart data={stats?.score_trend} />
            </div>
            <div style={chartCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={chartIconWrap}><CalendarCheck size={16} color="var(--accent)" /></div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.attendance')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.total_lessons', { count: stats?.attendance_summary?.total || 0 })}</p>
                </div>
              </div>
              <AttendanceDoughnut data={stats?.attendance_summary} />
            </div>
          </div>
        )}
      </motion.div>

      {/* Sticker shelf — students only */}
      {profile.role === 'student' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={{ ...chartIconWrap, background: 'rgba(217,119,6,0.1)' }}>
              <Star size={16} color="#D97706" fill="#D97706" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.stickers')}</p>
          </div>
          <StickerShelf count={stats?.total_stickers || 0} t={t} />
        </motion.div>
      )}

      {/* Groups */}
      {isOwn && groups.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={chartIconWrap}><Users size={16} color="var(--accent)" /></div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.my_groups')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {groups.map(g => (
              <Link key={g.id} to={`/groups/${g.id}`}
                style={{ display: 'block', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{g.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(me?.role === 'teacher' || me?.role === 'admin') ? <GraduationCap size={11} /> : <BookOpen size={11} />}
                  {(me?.role === 'teacher' || me?.role === 'admin') ? t('profile.teaching') : `${g.member_count} ${t('dashboard.students')}`}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const MAX_VISIBLE_STICKERS = 20

function StickerShelf({ count, t }) {
  if (count === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('profile.no_stickers')}</p>
  }
  const visible = Math.min(count, MAX_VISIBLE_STICKERS)
  const overflow = count - visible
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: visible }).map((_, i) => (
        <motion.div key={i}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: i * 0.035 }}
          style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Star size={18} color="#D97706" fill="#D97706" />
        </motion.div>
      ))}
      {overflow > 0 && (
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#D97706' }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

const ROLE_BADGE_MAP = {
  teacher: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', icon: GraduationCap, key: 'profile.teacher_badge' },
  student: { color: '#14B8A8', bg: 'rgba(20,184,168,0.1)',  border: 'rgba(20,184,168,0.3)',  icon: BookOpen,     key: 'profile.student_badge' },
  admin:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  icon: Shield,       key: 'profile.admin_badge' },
  parent:  { color: '#EC4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  icon: Heart,        key: 'profile.parent_badge' },
}

function RoleBadge({ role }) {
  const { t } = useTranslation()
  const cfg = ROLE_BADGE_MAP[role] || ROLE_BADGE_MAP.student
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: '3px 10px' }}>
      <Icon size={12} />
      {t(cfg.key)}
    </span>
  )
}

function ProfileStatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}

const chartCard     = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }
const chartIconWrap = { width: 34, height: 34, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const primaryBtn    = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn      = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
