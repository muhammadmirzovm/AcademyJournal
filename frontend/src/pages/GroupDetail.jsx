import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, Plus, Key, Copy, Check, Calendar, Loader2, ChevronRight, Trash2, Pencil, Star, Crown, CopyPlus, Send, UserCheck } from 'lucide-react'
import {
  getGroup, getMembers, getLessons, createLesson, updateLesson, deleteLesson,
  updateGroup, deleteGroup, updateMembership, removeMember, giveCoins,
  getGroupAnnouncements, createGroupAnnouncement, deleteAnnouncement, getExams,
} from '../api/groups'
import { AnnouncementsSection } from '../components/AnnouncementCard'
import ExamsTab from '../components/ExamsTab'
import { getGames, createGame, deleteGame, getTopics, duplicateGame } from '../api/quiz'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'

// ── Ranking ───────────────────────────────────────────────────────────────────

function rankMembers(members) {
  const cmp = (a, b) => {
    const d1 = (b.comprehension ?? -1) - (a.comprehension ?? -1); if (d1 !== 0) return d1
    const d2 = (b.attendance_rate ?? -1) - (a.attendance_rate ?? -1); if (d2 !== 0) return d2
    const d3 = (b.coin_balance ?? 0) - (a.coin_balance ?? 0); if (d3 !== 0) return d3
    return (b.sticker_count ?? 0) - (a.sticker_count ?? 0)
  }
  const sorted = [...members].sort(cmp)
  let rank = 1
  return sorted.map((m, i) => {
    if (i > 0 && cmp(sorted[i - 1], m) !== 0) rank = i + 1
    return { ...m, rank }
  })
}

// ── Podium ────────────────────────────────────────────────────────────────────

const PODIUM_COLORS = {
  1: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)', text: '#F59E0B', height: 100 },
  2: { border: '#94A3B8', bg: 'rgba(148,163,184,0.08)', text: '#94A3B8', height: 70 },
  3: { border: '#CD7F32', bg: 'rgba(205,127,50,0.08)', text: '#CD7F32', height: 50 },
}

function PodiumSlot({ members, rank, delay }) {
  const col = PODIUM_COLORS[rank]
  if (!members.length) return <div style={{ flex: 1 }} />
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      {/* Student cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%' }}>
        {members.slice(0, 2).map(m => (
          <div key={m.id} style={{ textAlign: 'center' }}>
            <motion.div
              animate={rank === 1 ? { boxShadow: ['0 0 0 0 rgba(245,158,11,0.5)', '0 0 0 10px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0.5)'] } : {}}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: rank === 1 ? 54 : 44, height: rank === 1 ? 54 : 44, borderRadius: '50%', margin: '0 auto 6px', background: col.bg, border: `2px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: rank === 1 ? 20 : 16, color: col.text, position: 'relative' }}
            >
              {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
              {rank === 1 && (
                <motion.div
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' }}
                >
                  <Crown size={16} color="#F59E0B" fill="#F59E0B" />
                </motion.div>
              )}
            </motion.div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, maxWidth: 80, wordBreak: 'break-word' }}>
              {m.first_name || m.username}
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: col.text, marginTop: 2 }}>
              {m.comprehension ?? 0}%
            </p>
          </div>
        ))}
        {members.length > 2 && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{members.length - 2} more</p>
        )}
      </div>

      {/* Podium bar */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'bottom', width: '100%', height: col.height, background: col.bg, border: `1.5px solid ${col.border}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ fontSize: rank === 1 ? 22 : 18, fontWeight: 800, color: col.text }}>
          {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
        </span>
      </motion.div>
    </motion.div>
  )
}

function Podium({ members, t }) {
  const ranked = rankMembers(members.filter(m => m.comprehension !== null))
  if (ranked.length === 0) return null

  const pos = { 1: ranked.filter(m => m.rank === 1), 2: ranked.filter(m => m.rank === 2), 3: ranked.filter(m => m.rank === 3) }

  const scored = members.filter(m => m.comprehension !== null)
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b.comprehension, 0) / scored.length) : null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 20px 0', marginBottom: 24, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 14 }}>{t('group_detail.podium_title')}</p>
        {avg !== null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 10px' }}>
            {t('group_detail.avg_label')}: <span style={{ color: 'var(--accent)' }}>{avg}%</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <PodiumSlot members={pos[2]} rank={2} delay={0.1} />
        <PodiumSlot members={pos[1]} rank={1} delay={0} />
        <PodiumSlot members={pos[3]} rank={3} delay={0.2} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [group, setGroup]     = useState(null)
  const [members, setMembers] = useState([])
  const [lessons, setLessons] = useState([])
  const [tab, setTab]         = useState('lessons')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)

  const [showAddLesson,     setShowAddLesson]     = useState(false)
  const [showEditGroup,     setShowEditGroup]      = useState(false)
  const [showDeleteGroup,   setShowDeleteGroup]    = useState(false)
  const [editingLesson,     setEditingLesson]      = useState(null)
  const [editingMembership, setEditingMembership] = useState(null)
  const [games,             setGames]             = useState([])
  const [showNewGame,       setShowNewGame]        = useState(false)
  const [announcements,     setAnnouncements]      = useState([])
  const [memberFilter,      setMemberFilter]       = useState('all')
  const [exams,             setExams]              = useState([])

  const isAdmin   = user?.role === 'admin'
  const isTeacher = (user?.role === 'teacher' && group?.teacher === user?.id) || isAdmin

  const load = async () => {
    setLoading(true)
    try {
      const [g, m, l, gm, anns, ex] = await Promise.all([
        getGroup(id), getMembers(id), getLessons(id), getGames(id),
        getGroupAnnouncements(id), getExams(id),
      ])
      setGroup(g.data); setMembers(m.data); setLessons(l.data); setGames(gm.data)
      setAnnouncements(anns.data); setExams(ex.data)
    } catch { show(t('group_detail.toast_load_fail'), 'error') }
    finally { setLoading(false) }
  }

  const handlePostGroupAnn = async data => {
    const { data: ann } = await createGroupAnnouncement(id, data)
    setAnnouncements(prev => [ann, ...prev].sort((a, b) => b.is_pinned - a.is_pinned || new Date(b.created_at) - new Date(a.created_at)))
    show(t('ann.toast_created'), 'success')
  }

  const handleDeleteGroupAnn = async annId => {
    await deleteAnnouncement(annId)
    setAnnouncements(prev => prev.filter(a => a.id !== annId))
    show(t('ann.toast_deleted'), 'success')
  }

  useEffect(() => { load() }, [id])

  const copy = () => { navigator.clipboard.writeText(group.join_key); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleDeleteGroup = async () => {
    try { await deleteGroup(id); show(t('group_detail.toast_group_deleted'), 'info'); navigate('/groups') }
    catch { show(t('group_detail.toast_group_delete_fail'), 'error') }
  }

  const handleDeleteLesson = async (lid) => {
    try { await deleteLesson(id, lid); setLessons(ls => ls.filter(x => x.id !== lid)); show(t('group_detail.toast_deleted'), 'info') }
    catch { show(t('group_detail.toast_delete_fail'), 'error') }
  }

  const handleRemoveMember = async (mid) => {
    try { await removeMember(id, mid); setMembers(ms => ms.filter(m => m.membership_id !== mid)); show(t('group_detail.toast_member_removed'), 'info') }
    catch { show(t('group_detail.toast_member_fail'), 'error') }
  }

  const handleCoin = async (studentId, membershipId, amount) => {
    const prev = members.find(m => m.membership_id === membershipId)
    try {
      const { data } = await giveCoins(id, { student: studentId, amount })
      setMembers(ms => ms.map(m => m.membership_id === membershipId ? { ...m, coin_balance: data.balance, sticker_count: data.sticker_count } : m))
      if (data.sticker_earned) show(t('group_detail.toast_sticker_earned'), 'success')
    } catch { show(t('group_detail.toast_coin_fail'), 'error') }
  }

  if (loading) return <Spinner />
  if (!group) return <p style={{ color: 'var(--text-muted)' }}>{t('group_detail.toast_load_fail')}</p>

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link to="/groups" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('common.groups')}</Link>
        <ChevronRight size={14} />
        <span>{group.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: 0 }}>{group.name}</h2>
            {group.is_individual && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', letterSpacing: '0.05em', flexShrink: 0 }}>
                INDIVIDUAL
              </span>
            )}
          </div>
          {group.description && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>{group.description}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {!group.is_individual && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Users size={14} />{members.length} {t('group_detail.students_count')}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BookOpen size={14} />{lessons.length} {t('group_detail.lessons_count')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star size={14} />{group.coin_threshold} {t('group_detail.coins')} = 1 {t('group_detail.stickers')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5,
              color: group.telegram_chat_id ? '#0EA5E9' : 'var(--text-muted)',
              background: group.telegram_chat_id ? 'rgba(14,165,233,0.1)' : 'rgba(0,0,0,0.04)',
              borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              {group.telegram_chat_id ? t('group_detail.tg_linked') : t('group_detail.tg_not_linked')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {isTeacher && (
            <>
              {!group.is_individual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
                  <Key size={14} color="var(--accent)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.12em', fontWeight: 600 }}>{group.join_key}</span>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={copy}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: copied ? 'var(--success)' : 'var(--text-muted)', padding: 0 }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t('group_detail.copied') : t('group_detail.copy_key')}
                  </motion.button>
                </div>
              )}
              <button onClick={() => setShowEditGroup(true)} style={ghostBtn}><Pencil size={13} /> {t('group_detail.edit_group')}</button>
              <button onClick={() => setShowDeleteGroup(true)} style={dangerOutlineBtn}><Trash2 size={13} /> {t('group_detail.delete_group')}</button>
            </>
          )}
        </div>
      </div>

      {/* Podium — only for group (not individual) with scored members */}
      {!group.is_individual && members.some(m => m.comprehension !== null) && <Podium members={members} t={t} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { key: 'lessons',       label: t('group_detail.tab_lessons') },
          ...(!group.is_individual ? [{ key: 'members', label: t('group_detail.tab_members') }] : []),
          { key: 'games',         label: t('quiz.games') },
          { key: 'announcements', label: t('ann.tab') },
          { key: 'exams',         label: t('exam.tab') },
        ].map(item => (
          <button key={item.key} className="tab-btn" onClick={() => setTab(item.key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
            color: tab === item.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === item.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s', flexShrink: 0,
          }}>{item.label}</button>
        ))}
      </div>

      {/* Lessons tab */}
      {tab === 'lessons' && (
        <div>
          {isTeacher && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddLesson(true)} style={primaryBtn}>
                <Plus size={14} /> {t('group_detail.add_lesson')}
              </motion.button>
            </div>
          )}
          {lessons.length === 0 ? (
            <EmptyTab icon={BookOpen} text={t('group_detail.no_lessons')} sub={isTeacher ? t('group_detail.no_lessons_teacher') : t('group_detail.no_lessons_student')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lessons.map((l, i) => (
                <LessonRow key={l.id} lesson={l} groupId={id} index={i} isTeacher={isTeacher}
                  onEdit={() => setEditingLesson(l)} onDelete={() => handleDeleteLesson(l.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          {members.length === 0 ? (
            <EmptyTab icon={Users} text={t('group_detail.no_students')} sub={t('group_detail.no_students_sub')} />
          ) : (
            <>
              {isTeacher && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all',         label: t('group_detail.filter_all'),         icon: null },
                    { key: 'with_parent', label: t('group_detail.filter_with_parent'), icon: <UserCheck size={12} /> },
                    { key: 'no_parent',   label: t('group_detail.filter_no_parent'),   icon: null },
                  ].map(f => (
                    <button key={f.key} onClick={() => setMemberFilter(f.key)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      borderColor: memberFilter === f.key ? 'var(--accent)' : 'var(--border)',
                      background:  memberFilter === f.key ? 'var(--accent-bg)' : 'transparent',
                      color:       memberFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                      {f.icon}{f.label}
                      {f.key === 'with_parent' && (
                        <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, lineHeight: '16px' }}>
                          {members.filter(m => m.has_parent).length}
                        </span>
                      )}
                      {f.key === 'no_parent' && (
                        <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, lineHeight: '16px' }}>
                          {members.filter(m => !m.has_parent).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rankMembers(members)
                  .filter(m => memberFilter === 'with_parent' ? m.has_parent : memberFilter === 'no_parent' ? !m.has_parent : true)
                  .map((m, i) => (
                    <MemberRow key={m.membership_id} member={m} index={i} isTeacher={isTeacher}
                      onEditJoinDate={() => setEditingMembership(m)}
                      onRemove={() => handleRemoveMember(m.membership_id)}
                      onCoin={(amount) => handleCoin(m.id, m.membership_id, amount)} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Games tab */}
      {tab === 'games' && (
        <div>
          {isTeacher && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowNewGame(true)} style={primaryBtn}>
                <Plus size={14} /> {t('quiz.new_game')}
              </motion.button>
            </div>
          )}
          {games.length === 0 ? (
            <EmptyTab icon={Users} text={t('quiz.no_games')} sub={t('quiz.no_games_sub')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {games.map((g, i) => <GameRow key={g.id} game={g} groupId={id} index={i} isTeacher={isTeacher}
                onDelete={async () => { try { await deleteGame(id, g.id); setGames(gs => gs.filter(x => x.id !== g.id)) } catch {} }}
                onDuplicated={copy => setGames(gs => [copy, ...gs])} />)}
            </div>
          )}
        </div>
      )}

      {/* Announcements tab */}
      {tab === 'announcements' && (
        <AnnouncementsSection
          announcements={announcements}
          loading={false}
          canPost={isTeacher}
          onPost={handlePostGroupAnn}
          onDelete={handleDeleteGroupAnn}
        />
      )}

      {/* Exams tab */}
      {tab === 'exams' && (
        <ExamsTab
          group={group}
          members={members}
          exams={exams}
          setExams={setExams}
          isAdmin={isAdmin}
          isTeacher={isTeacher && !isAdmin}
          userId={user?.id}
          groupId={id}
        />
      )}

      {/* Modals */}
      <AddLessonModal open={showAddLesson} onClose={() => setShowAddLesson(false)} groupId={id}
        onAdded={l => { setLessons(ls => [l, ...ls]); setShowAddLesson(false); show(t('group_detail.toast_added'), 'success') }} />
      <EditLessonModal open={!!editingLesson} onClose={() => setEditingLesson(null)} lesson={editingLesson} groupId={id}
        onUpdated={u => { setLessons(ls => ls.map(l => l.id === u.id ? u : l)); setEditingLesson(null); show(t('group_detail.toast_lesson_updated'), 'success') }} />
      <EditGroupModal open={showEditGroup} onClose={() => setShowEditGroup(false)} group={group} groupId={id}
        onUpdated={u => { setGroup(g => ({ ...g, ...u })); setShowEditGroup(false); show(t('group_detail.toast_group_updated'), 'success') }} />
      <DeleteGroupModal open={showDeleteGroup} onClose={() => setShowDeleteGroup(false)} onConfirm={handleDeleteGroup} />
      <EditJoinDateModal open={!!editingMembership} onClose={() => setEditingMembership(null)} membership={editingMembership} groupId={id}
        onUpdated={u => { setMembers(ms => ms.map(m => m.membership_id === u.membership_id ? { ...m, ...u } : m)); setEditingMembership(null); show(t('group_detail.toast_join_updated'), 'success') }} />
      <NewGameModal open={showNewGame} onClose={() => setShowNewGame(false)} groupId={id}
        onCreated={g => { setGames(gs => [g, ...gs]); setShowNewGame(false); show(t('quiz.toast_game_created'), 'success') }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Lesson Row ────────────────────────────────────────────────────────────────

function LessonRow({ lesson, groupId, index, isTeacher, onEdit, onDelete }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Calendar size={18} color="var(--accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <Link to={`/groups/${groupId}/lessons/${lesson.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'var(--text)' }}>{lesson.title}</Link>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {new Date(lesson.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
      <Link to={`/groups/${groupId}/lessons/${lesson.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
        {t('group_detail.open')} <ChevronRight size={14} />
      </Link>
      {isTeacher && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onEdit} style={iconActionBtn}><Pencil size={14} color="var(--text-muted)" /></button>
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.delete')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} style={iconActionBtn}><Trash2 size={14} color="var(--text-muted)" /></button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({ member: m, index, isTeacher, onEditJoinDate, onRemove, onCoin }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const pct   = m.comprehension
  const color = pct === null ? 'var(--border)' : pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)'
  const isFirst = m.rank === 1

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
      style={{ background: 'var(--surface)', border: `1px solid ${isFirst ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Rank badge */}
        <div style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>
          {m.rank <= 3 ? (
            <span style={{ fontSize: 13, fontWeight: 800, color: PODIUM_COLORS[m.rank]?.text || 'var(--text-muted)' }}>
              {m.rank === 1 ? '1st' : m.rank === 2 ? '2nd' : '3rd'}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{m.rank}</span>
          )}
        </div>

        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: isFirst ? 'rgba(245,158,11,0.12)' : 'var(--accent-bg)', border: `1.5px solid ${isFirst ? '#F59E0B' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: isFirst ? '#F59E0B' : 'var(--accent)', flexShrink: 0 }}>
          {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 80 }}>
          <Link to={`/profile/${m.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'var(--text)' }}>
            {m.first_name} {m.last_name}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {isTeacher && <button onClick={onEditJoinDate} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><Pencil size={11} /></button>}
            <span title={m.has_parent ? t('group_detail.badge_has_parent') : t('group_detail.badge_no_parent')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: m.has_parent ? 'rgba(20,184,168,0.12)' : 'rgba(148,163,184,0.08)',
                color: m.has_parent ? '#14B8A6' : 'var(--text-muted)' }}>
              <UserCheck size={9} />{m.has_parent ? t('group_detail.badge_has_parent') : t('group_detail.badge_no_parent')}
            </span>
            <span title={m.student_telegram ? t('group_detail.badge_tg_yes') : t('group_detail.badge_tg_no')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: m.student_telegram ? 'rgba(99,102,241,0.1)' : 'rgba(148,163,184,0.08)',
                color: m.student_telegram ? '#6366F1' : 'var(--text-muted)' }}>
              <Send size={9} />TG
            </span>
          </div>
        </div>

        {/* Coins */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
            <Star size={13} color="#F59E0B" fill="#F59E0B" /> {m.coin_balance ?? 0}
          </span>
          {m.sticker_count > 0 && (
            <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              <Star size={13} color="var(--accent)" fill="var(--accent)" /> {m.sticker_count}
            </span>
          )}
          {isTeacher && (
            <div style={{ display: 'flex', gap: 3 }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => onCoin(1)}
                style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => onCoin(-1)}
                style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</motion.button>
            </div>
          )}
        </div>

        {/* Comprehension */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
          {pct !== null ? <span style={{ fontSize: 15, fontWeight: 700, color }}>{pct}%</span>
            : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('group_detail.no_scores')}</span>}
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t('group_detail.comprehension')}</p>
        </div>

        {/* Remove */}
        {isTeacher && (
          <div style={{ flexShrink: 0 }}>
            {confirm ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={onRemove} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.remove_student')}</button>
                <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} style={iconActionBtn}><Trash2 size={14} color="var(--text-muted)" /></button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.04 }}
          style={{ height: '100%', borderRadius: 99, background: color }} />
      </div>
    </motion.div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function AddLessonModal({ open, onClose, onAdded, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10) })
  const [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('group_detail.err_title_required')); return }
    setLoading(true)
    try { const { data } = await createLesson(groupId, form); setForm({ title: '', date: new Date().toISOString().slice(0, 10) }); onAdded(data) }
    catch { show(t('group_detail.toast_load_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.add_lesson_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('group_detail.lesson_title')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} placeholder={t('group_detail.lesson_title_placeholder')}
            value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.lesson_date')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.add_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function EditLessonModal({ open, onClose, onUpdated, lesson, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', date: '' })
  const [error, setError] = useState('')
  useEffect(() => { if (lesson) setForm({ title: lesson.title, date: lesson.date }) }, [lesson])
  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('group_detail.err_title_required')); return }
    setLoading(true)
    try { const { data } = await updateLesson(groupId, lesson.id, form); onUpdated(data) }
    catch { show(t('group_detail.toast_lesson_update_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.edit_lesson_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('group_detail.lesson_title')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.title}
            onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.lesson_date')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

const WEEKDAYS = [
  { label: 'Mo', value: 0 }, { label: 'Tu', value: 1 }, { label: 'We', value: 2 },
  { label: 'Th', value: 3 }, { label: 'Fr', value: 4 }, { label: 'Sa', value: 5 }, { label: 'Su', value: 6 },
]

function EditGroupModal({ open, onClose, onUpdated, group, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', coin_threshold: 10, class_days: [], telegram_chat_id: '', language: 'uz' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (group) setForm({
      name: group.name,
      description: group.description || '',
      coin_threshold: group.coin_threshold || 10,
      class_days: Array.isArray(group.class_days) ? group.class_days : [],
      telegram_chat_id: group.telegram_chat_id ?? '',
      language: group.language || 'uz',
    })
  }, [group])

  const toggleDay = day => setForm(f => ({
    ...f,
    class_days: f.class_days.includes(day)
      ? f.class_days.filter(d => d !== day)
      : [...f.class_days, day].sort((a, b) => a - b),
  }))

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('groups.err_name_required')); return }
    setLoading(true)
    const payload = {
      ...form,
      telegram_chat_id: form.telegram_chat_id !== '' ? Number(form.telegram_chat_id) : null,
    }
    try { const { data } = await updateGroup(groupId, payload); onUpdated(data) }
    catch { show(t('group_detail.toast_group_update_fail'), 'error') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.edit_group_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.group_name')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('groups.description_optional')}</span></label>
          <textarea style={{ ...inputStyle(false), marginTop: 6, resize: 'vertical', minHeight: 72 }}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('group_detail.coin_threshold_label')}</label>
          <input type="number" min={1} max={100} style={{ ...inputStyle(false), marginTop: 6 }}
            value={form.coin_threshold} onChange={e => setForm(f => ({ ...f, coin_threshold: Number(e.target.value) }))} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('groups.class_days')}</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS.map(day => {
              const active = form.class_days.includes(day.value)
              return (
                <button key={day.value} type="button" onClick={() => toggleDay(day.value)}
                  style={{
                    width: 38, height: 38, borderRadius: 9,
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ marginBottom: 24, padding: '14px 16px', background: 'rgba(14,165,233,0.06)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.15)' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            {t('group_detail.telegram_chat_id_label')}
          </label>
          <input
            style={{ ...inputStyle(false), marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 14 }}
            placeholder="-100123456789"
            value={form.telegram_chat_id}
            onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('group_detail.telegram_chat_id_hint')}
          </p>
          <div style={{ marginTop: 10 }}>
            <label style={{ ...labelStyle, marginBottom: 6, display: 'block' }}>{t('group_detail.group_language')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ value: 'uz', label: "🇺🇿 O'zbek" }, { value: 'ru', label: '🇷🇺 Русский' }].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, language: opt.value }))}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${form.language === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.language === opt.value ? 'var(--accent)' : 'transparent',
                    color: form.language === opt.value ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteGroupModal({ open, onClose, onConfirm }) {
  const { t } = useTranslation(); const [loading, setLoading] = useState(false)
  const handle = async () => { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.delete_group')}>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{t('group_detail.delete_group_confirm')}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
        <motion.button onClick={handle} disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...dangerBtn, opacity: loading ? 0.7 : 1 }}>
          {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {t('group_detail.delete_group_btn')}
        </motion.button>
      </div>
    </Modal>
  )
}

function EditJoinDateModal({ open, onClose, onUpdated, membership, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false); const [date, setDate] = useState('')
  useEffect(() => { if (membership) setDate(membership.joined_at?.slice(0, 10) || '') }, [membership])
  const submit = async e => {
    e.preventDefault(); if (!date) return; setLoading(true)
    try { const { data } = await updateMembership(groupId, membership.membership_id, { joined_at: date }); onUpdated(data) }
    catch { show(t('group_detail.toast_join_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.join_date_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.join_date_label')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={date} onChange={e => setDate(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

// ── Game Row ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = { waiting: 'var(--text-muted)', active: 'var(--success)', final: 'var(--warning)', finished: 'var(--accent)' }

function GameRow({ game, groupId, index, isTeacher, onDelete, onDuplicated }) {
  const { t, i18n } = useTranslation()
  const { show } = useToast()
  const [confirm,    setConfirm]    = useState(false)
  const [copying,    setCopying]    = useState(false)
  const statusKey = `quiz.status_${game.status}`

  const handleDuplicate = async () => {
    setCopying(true)
    try {
      const { data } = await duplicateGame(groupId, game.id)
      onDuplicated(data)
      show(t('quiz.toast_game_copied'), 'success')
    } catch { show(t('quiz.toast_game_copy_fail'), 'error') }
    finally { setCopying(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Users size={18} color="var(--accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>{game.name}</p>
        <p style={{ fontSize: 12, color: STATUS_COLOR[game.status] || 'var(--text-muted)', marginTop: 2 }}>
          {t(statusKey)} · {game.team_count} {t('quiz.teams')}
          {game.question_count > 0 && (
            <span style={{ color: 'var(--text-muted)' }}> · {game.question_count} {t('quiz.questions_in_game').toLowerCase()}</span>
          )}
        </p>
      </div>
      <Link to={`/groups/${groupId}/games/${game.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
        {t('quiz.open_game')} <ChevronRight size={14} />
      </Link>
      {isTeacher && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleDuplicate} disabled={copying} title={t('quiz.duplicate_game')}
            style={{ ...iconActionBtn, opacity: copying ? 0.5 : 1 }}>
            {copying ? <Loader2 size={14} color="var(--text-muted)" style={{ animation: 'spin 0.7s linear infinite' }} /> : <CopyPlus size={14} color="var(--text-muted)" />}
          </motion.button>
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.delete')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} style={iconActionBtn}><Trash2 size={14} color="var(--text-muted)" /></button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── New Game Modal ────────────────────────────────────────────────────────────

const DIFF_ORDER = ['easy', 'medium', 'hard']
const DIFF_COLOR_MAP = { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' }

function DiffInput({ diff, available, value, onChange, t }) {
  const val = Number(value) || 0
  const over = val > available
  const color = DIFF_COLOR_MAP[diff]
  const diffKey = `quiz.${diff}`
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t(diffKey)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{available}</span>
      </div>
      <input
        type="number" min={0} max={available}
        value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        style={{
          width: '100%', padding: '5px 6px', borderRadius: 6, textAlign: 'center',
          border: `1.5px solid ${over ? 'var(--danger)' : val > 0 ? color : 'var(--border)'}`,
          background: over ? 'rgba(239,68,68,0.06)' : val > 0 ? `${color}12` : 'var(--surface)',
          color: over ? 'var(--danger)' : 'var(--text)', fontSize: 13, fontWeight: 700, outline: 'none',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        disabled={available === 0}
        title={available === 0 ? t('quiz.none_available') : undefined}
      />
      {over && (
        <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>
          max {available}
        </span>
      )}
    </div>
  )
}

function NewGameModal({ open, onClose, groupId, onCreated }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading,       setLoading]       = useState(false)
  const [topics,        setTopics]        = useState([])
  const [diffCounts,    setDiffCounts]    = useState({})
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [form, setForm] = useState({ name: '', timer_seconds: 30, team_count: 2 })
  const [formError, setFormError] = useState('')

  const reset = () => {
    setForm({ name: '', timer_seconds: 30, team_count: 2 })
    setTopics([]); setDiffCounts({}); setFormError('')
  }

  useEffect(() => {
    if (open) {
      setTopicsLoading(true)
      getTopics().then(res => {
        setTopics(res.data)
        const init = {}
        res.data.forEach(tp => { init[tp.id] = { easy: 0, medium: 0, hard: 0 } })
        setDiffCounts(init)
      }).catch(() => {}).finally(() => setTopicsLoading(false))
    }
    if (!open) reset()
  }, [open])

  const setCount = (topicId, diff, val) => {
    setDiffCounts(c => ({ ...c, [topicId]: { ...c[topicId], [diff]: val } }))
    setFormError('')
  }

  const totalQ = Object.values(diffCounts).reduce((sum, dc) =>
    sum + DIFF_ORDER.reduce((s, d) => s + (Number(dc[d]) || 0), 0), 0)

  const hasOverflow = topics.some(tp => {
    const dc = diffCounts[tp.id] || {}
    return (Number(dc.easy) || 0) > tp.easy_count
        || (Number(dc.medium) || 0) > tp.medium_count
        || (Number(dc.hard) || 0) > tp.hard_count
  })

  const topicSelected = id => {
    const dc = diffCounts[id] || {}
    return DIFF_ORDER.some(d => (Number(dc[d]) || 0) > 0)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError(t('quiz.err_game_name')); return }
    if (totalQ === 0)       { setFormError(t('quiz.err_no_questions')); return }
    if (hasOverflow)        { setFormError(t('quiz.err_overflow')); return }
    setFormError('')
    setLoading(true)
    try {
      const { data } = await createGame(groupId, {
        ...form,
        topic_difficulty_counts: diffCounts,
      })
      onCreated(data)
    } catch (err) {
      show(err?.response?.data?.detail || t('quiz.toast_game_fail'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('quiz.new_game')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t('quiz.game_name')}</label>
          <input style={{ ...inputStyle(false), marginTop: 5 }} placeholder={t('quiz.game_name_placeholder')}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>{t('quiz.timer')}</label>
            <input type="number" min={5} max={300} style={{ ...inputStyle(false), marginTop: 5 }}
              value={form.timer_seconds} onChange={e => setForm(f => ({ ...f, timer_seconds: Number(e.target.value) }))} />
          </div>
          <div>
            <label style={labelStyle}>{t('quiz.team_count')}</label>
            <input type="number" min={2} max={8} style={{ ...inputStyle(false), marginTop: 5 }}
              value={form.team_count} onChange={e => setForm(f => ({ ...f, team_count: Number(e.target.value) }))} />
          </div>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('quiz.select_questions')}
          </p>
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 8px',
            color: totalQ > 0 ? 'var(--accent)' : 'var(--text-muted)',
            background: totalQ > 0 ? 'var(--accent-bg)' : 'var(--bg)',
            border: `1px solid ${totalQ > 0 ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {totalQ} {t('quiz.questions_selected')}
          </span>
        </div>

        {/* Topics list with per-difficulty inputs */}
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, paddingRight: 2 }}>
          {topicsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : topics.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>{t('quiz.no_topics_hint')}</p>
          ) : topics.map(tp => {
            const dc = diffCounts[tp.id] || { easy: 0, medium: 0, hard: 0 }
            const sel = topicSelected(tp.id)
            return (
              <div key={tp.id} style={{
                background: sel ? 'var(--accent-bg)' : 'var(--bg)',
                border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 12px', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tp.name}</span>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tp.created_by_name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['easy', tp.easy_count, '#22C55E'], ['medium', tp.medium_count, '#F59E0B'], ['hard', tp.hard_count, '#EF4444']].map(([d, cnt, col]) => (
                      <span key={d} style={{ fontSize: 10, fontWeight: 700, color: cnt > 0 ? col : 'var(--text-muted)', background: cnt > 0 ? `${col}18` : 'transparent', border: `1px solid ${cnt > 0 ? `${col}40` : 'var(--border)'}`, borderRadius: 4, padding: '1px 5px' }}>
                        {cnt}{d[0].toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIFF_ORDER.map(d => (
                    <DiffInput key={d} diff={d} available={tp[`${d}_count`]} value={dc[d]} onChange={v => setCount(tp.id, d, v)} t={t} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {formError && (
          <p style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>
            ⚠ {formError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading || hasOverflow} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }}
            style={{ ...primaryBtn, opacity: loading || hasOverflow ? 0.6 : 1, cursor: hasOverflow ? 'not-allowed' : 'pointer' }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('quiz.saving') : t('quiz.new_game')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EmptyTab({ icon: Icon, text, sub }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 52, height: 52, background: 'var(--accent-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={24} color="var(--accent)" />
      </div>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{text}</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</p>
    </motion.div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Loader2 size={30} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const primaryBtn       = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn         = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }
const dangerBtn        = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const dangerOutlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const iconActionBtn    = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 6 }
const labelStyle       = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const errorStyle       = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }
const inputStyle       = (hasError) => ({ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', display: 'block' })
