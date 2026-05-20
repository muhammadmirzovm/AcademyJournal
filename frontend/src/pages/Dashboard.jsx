import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, Plus, LogIn, ArrowRight, GraduationCap, X, Loader2, Trophy, Star, MessageCircle, AlertTriangle } from 'lucide-react'
import { getGroups, joinGroup } from '../api/groups'
import { getAdminStats, getTeacherLeaderboard } from '../api/users'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CardSkeleton } from '../components/ui/Skeleton'

const ROLE_SUB = {
  teacher: 'dashboard.teacher_sub',
  admin:   'dashboard.admin_sub',
  parent:  'dashboard.parent_sub',
  student: 'dashboard.student_sub',
}

const ROLE_LABEL = {
  teacher: 'dashboard.role_teacher',
  admin:   'dashboard.role_admin',
  parent:  'dashboard.role_parent',
  student: 'dashboard.role_student',
}

export default function Dashboard() {
  const { user } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const role = user?.role || 'student'
  const isTeacherOrAdmin = role === 'teacher' || role === 'admin'
  const isParent  = role === 'parent'
  const isStudent = role === 'student'

  const [groups,     setGroups]     = useState([])
  const [children,   setChildren]   = useState([])
  const [adminStats, setAdminStats] = useState(null)
  const [loading,    setLoading]    = useState(true)

  const [leaderboard, setLeaderboard] = useState([])

  const [showJoin, setShowJoin] = useState(false)
  const [joinKey,  setJoinKey]  = useState('')
  const [joinErr,  setJoinErr]  = useState('')
  const [joining,  setJoining]  = useState(false)

  const [nudgeDismissed, setNudgeDismissed] = useState(
    () => localStorage.getItem('tg_nudge_dismissed') === '1'
  )
  const showNudge = !nudgeDismissed && user && !user.telegram_id

  const dismissNudge = () => {
    localStorage.setItem('tg_nudge_dismissed', '1')
    setNudgeDismissed(true)
  }

  useEffect(() => {
    if (isParent) {
      api.get('/auth/my-children/').then(r => setChildren(r.data)).finally(() => setLoading(false))
    } else if (role === 'admin') {
      getAdminStats().then(r => setAdminStats(r.data)).finally(() => setLoading(false))
    } else if (role === 'teacher') {
      Promise.all([
        getGroups().then(r => setGroups(r.data)),
        getTeacherLeaderboard().then(r => setLeaderboard(r.data)),
      ]).finally(() => setLoading(false))
    } else {
      getGroups().then(r => setGroups(r.data)).finally(() => setLoading(false))
    }
  }, [role])

  const handleJoin = async e => {
    e.preventDefault()
    if (!joinKey.trim()) { setJoinErr(t('groups.err_key_required')); return }
    setJoining(true)
    try {
      const { data } = await joinGroup(joinKey.trim())
      setGroups(gs => [data, ...gs])
      setShowJoin(false)
      setJoinKey('')
      setJoinErr('')
      show(t('groups.toast_joined', { name: data.name }), 'success')
    } catch (err) {
      setJoinErr(err.response?.data?.detail || t('groups.err_key_required'))
    } finally { setJoining(false) }
  }

  const openJoin = () => { setShowJoin(true); setJoinKey(''); setJoinErr('') }

  return (
    <div>
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h2 className="page-title" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {t('dashboard.welcome', { name: user?.first_name || user?.username })}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {t(ROLE_SUB[role] || ROLE_SUB.student)}
        </p>
      </div>

      <AnimatePresence>
        {showNudge && (
          <motion.div
            key="tg-nudge"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', marginBottom: 20 }}
          >
            <div className="nudge-banner" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(20,184,168,0.1), rgba(13,148,136,0.06))',
              border: '1px solid rgba(20,184,168,0.25)',
            }}>
              <MessageCircle size={20} color="#0D9488" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0D9488' }}>
                  {t('tg_nudge.title')}
                </span>
                {' — '}
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('tg_nudge.desc')}
                </span>
              </div>
              <Link to={`/profile/${user?.id}`} style={{
                fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
                background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
                padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                boxShadow: '0 4px 12px rgba(20,184,168,0.3)',
              }}>
                {t('tg_nudge.cta')}
              </Link>
              <button onClick={dismissNudge} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0,
              }}>
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
        {role === 'admin' ? (
          <>
            <StatCard icon={Users}     label={t('dashboard.total_students')} value={loading ? '…' : (adminStats?.total_students ?? '…')} color="#14B8A8" />
            <StatCard icon={GraduationCap} label={t('dashboard.total_teachers')} value={loading ? '…' : (adminStats?.total_teachers ?? '…')} color="#8B5CF6" />
            <StatCard icon={BookOpen}  label={t('dashboard.total_groups')}   value={loading ? '…' : (adminStats?.total_groups   ?? '…')} color="#0891B2" />
            <StatCard icon={Trophy}    label={t('dashboard.total_lessons')}  value={loading ? '…' : (adminStats?.total_lessons  ?? '…')} color="#F59E0B" />
          </>
        ) : (
          <>
            {!isParent && (
              <StatCard icon={Users} label={t('dashboard.groups_label')} value={loading ? '…' : groups.length} color="var(--accent)" />
            )}
            <StatCard icon={BookOpen} label={t('dashboard.role_label')} value={t(ROLE_LABEL[role] || ROLE_LABEL.student)} color="var(--warning)" />
          </>
        )}
      </div>

      {/* Admin overview */}
      {role === 'admin' && (
        <div className="fade-up-3">
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <CardSkeleton /><CardSkeleton />
            </div>
          ) : (
            <div className="mobile-single" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

              {/* Top Groups */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(8,145,178,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={16} color="#0891B2" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{t('dashboard.top_groups')}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('dashboard.by_avg_score')}</p>
                  </div>
                  <Link to="/groups" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {t('dashboard.view_all')} <ArrowRight size={12} />
                  </Link>
                </div>
                {adminStats?.top_groups?.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.no_data_yet')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {adminStats?.top_groups?.map((g, i) => (
                      <motion.div key={g.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <Link to={`/groups/${g.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['#F59E0B','#94A3B8','#CD7F32','var(--accent)','var(--accent)'][i] + '22', color: ['#F59E0B','#94A3B8','#CD7F32','var(--accent)','var(--accent)'][i], fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.teacher_name} · {g.member_count} {t('dashboard.students')}</p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: g.avg_score >= 70 ? '#14B8A8' : g.avg_score >= 40 ? '#F59E0B' : '#EF4444', flexShrink: 0 }}>
                            {g.avg_score}%
                          </span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Students */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={16} color="#F59E0B" fill="#F59E0B" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{t('dashboard.top_students')}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('dashboard.by_comprehension')}</p>
                  </div>
                </div>
                {adminStats?.top_students?.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.no_data_yet')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {adminStats?.top_students?.map((s, i) => (
                      <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <Link to={`/profile/${s.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['#F59E0B','#94A3B8','#CD7F32','var(--accent)','var(--accent)'][i] + '22', color: ['#F59E0B','#94A3B8','#CD7F32','var(--accent)','var(--accent)'][i], fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
                              {s.groups?.length > 0 ? s.groups.join(', ') : '—'}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Star size={10} color="#F59E0B" fill="#F59E0B" /> {s.sticker_count} {t('dashboard.stickers')}</p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.comprehension >= 70 ? '#14B8A8' : s.comprehension >= 40 ? '#F59E0B' : '#EF4444', flexShrink: 0 }}>
                            {s.comprehension}%
                          </span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Parents */}
      {isParent ? (
        <div className="fade-up-3">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16 }}>{t('dashboard.my_children')}</h3>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[0, 1].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : children.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('dashboard.no_children')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {children.map((child, i) => (
                <motion.div key={child.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ height: 4, background: '#EC4899' }} />
                  <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(20,184,168,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={18} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/profile/${child.id}`} style={{ fontWeight: 700, fontSize: 14, textDecoration: 'none', color: 'var(--text)', display: 'block', marginBottom: 2 }}>
                        {child.display_name}
                      </Link>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{child.username}</p>
                    </div>
                    <Link to={`/profile/${child.id}`} style={{ marginLeft: 'auto', color: 'var(--accent)', display: 'flex' }}>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : role === 'teacher' ? (
        <div className="fade-up-3">

          {/* Podium */}
          {!loading && leaderboard.length >= 3 && (() => {
            const top = leaderboard.slice(0, 3)
            const MEDALS = [
              { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', height: 80, label: '🥇' },
              { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', height: 60, label: '🥈' },
              { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', height: 50, label: '🥉' },
            ]
            const order = [top[1], top[0], top[2]]
            const heights = [MEDALS[1], MEDALS[0], MEDALS[2]]
            return (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>{t('dashboard.leaderboard')}</h3>
                <div className="podium-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                  {order.map((s, i) => {
                    const medal = heights[i]
                    const rank = i === 1 ? 0 : i === 0 ? 1 : 2
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, maxWidth: 140 }}>
                        <Link to={`/profile/${s.id}`} style={{ textDecoration: 'none', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: medal.bg, border: `2px solid ${medal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontSize: 20 }}>
                            {MEDALS[rank].label}
                          </div>
                          <p className="podium-name" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{s.display_name}</p>
                          <p style={{ fontSize: 12, color: medal.color, fontWeight: 800 }}>{s.avg_score ?? '—'}%</p>
                        </Link>
                        <div style={{ width: '100%', background: medal.bg, border: `1px solid ${medal.color}40`, borderRadius: '8px 8px 0 0', height: medal.height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: medal.color }}>{rank + 1}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Full ranking */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', marginBottom: 24 }}>
                  {leaderboard.map((s, i) => (
                    <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ width: 26, height: 26, borderRadius: '50%', background: i < 3 ? ['rgba(245,158,11,0.15)','rgba(148,163,184,0.15)','rgba(205,127,50,0.15)'][i] : 'var(--bg)', border: '1px solid var(--border)', color: i < 3 ? ['#F59E0B','#94A3B8','#CD7F32'][i] : 'var(--text-muted)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/profile/${s.id}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</Link>
                        <p className="lb-group" style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.groups?.join(', ')}</p>
                      </div>
                      {s.attendance != null && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {s.attendance}% att.
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.avg_score == null ? 'var(--text-muted)' : s.avg_score >= 80 ? '#14B8A8' : s.avg_score >= 60 ? '#F59E0B' : '#EF4444', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                        {s.avg_score != null ? `${s.avg_score}%` : '—'}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* At-risk students */}
                {leaderboard.filter(s => s.avg_score != null && s.avg_score < 80).length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <AlertTriangle size={16} color="#EF4444" />
                      <p style={{ fontWeight: 700, fontSize: 14, color: '#EF4444' }}>{t('dashboard.at_risk')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>({t('dashboard.below_80')})</span></p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {leaderboard.filter(s => s.avg_score != null && s.avg_score < 80).map((s, i) => (
                        <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Link to={`/profile/${s.id}`} style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</Link>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{s.groups?.join(', ')}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{s.avg_score}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Groups */}
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
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{t('dashboard.no_groups_teacher')}</p>
              <Link to="/groups" style={primaryBtn}><Plus size={14} /> {t('dashboard.create_group')}</Link>
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
      ) : (
        <div className="fade-up-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16 }}>{t('dashboard.my_groups')}</h3>
            {isTeacherOrAdmin && (
              <Link to="/groups" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                {t('dashboard.view_all')} <ArrowRight size={14} />
              </Link>
            )}
            {isStudent && (
              <button onClick={openJoin} style={secondaryBtn}>
                <LogIn size={13} /> {t('dashboard.join_group')}
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[0,1,2].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : groups.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                {isTeacherOrAdmin ? t('dashboard.no_groups_teacher') : t('dashboard.no_groups_student')}
              </p>
              {isTeacherOrAdmin ? (
                <Link to="/groups" style={primaryBtn}>
                  <Plus size={14} /> {t('dashboard.create_group')}
                </Link>
              ) : (
                <button onClick={openJoin} style={primaryBtn}>
                  <LogIn size={14} /> {t('dashboard.join_group')}
                </button>
              )}
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
      )}

      {/* Join group modal — students only */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowJoin(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>{t('groups.join_modal_title')}</h3>
                <button onClick={() => setShowJoin(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>{t('groups.join_hint')}</p>
              <form onSubmit={handleJoin}>
                <input
                  value={joinKey} onChange={e => { setJoinKey(e.target.value.toUpperCase()); setJoinErr('') }}
                  placeholder={t('groups.join_key_placeholder')}
                  maxLength={8} autoFocus
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1.5px solid ${joinErr ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', outline: 'none', boxSizing: 'border-box', marginBottom: joinErr ? 6 : 16 }}
                />
                {joinErr && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{joinErr}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setShowJoin(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {t('groups.cancel')}
                  </button>
                  <motion.button type="submit" disabled={joining} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {joining ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <LogIn size={14} />}
                    {joining ? t('groups.joining') : t('groups.join_btn')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

const primaryBtn   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
const secondaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
