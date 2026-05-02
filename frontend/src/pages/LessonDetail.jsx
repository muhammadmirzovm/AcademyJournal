import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Save, Loader2, CheckSquare, Star, BookOpen, Users, ClipboardList } from 'lucide-react'
import { getGroup, getMembers, getLessons, getAttendance, saveAttendance, getScores, saveScores, getJournal, saveJournal, getHomework, saveHomework, setHomeworkAssignment } from '../api/groups'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LessonDetail() {
  const { groupId, lessonId } = useParams()
  const { user } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()

  const [group, setGroup]           = useState(null)
  const [lesson, setLesson]         = useState(null)
  const [members, setMembers]       = useState([])
  const [attendance, setAttendance] = useState([])
  const [scores, setScores]         = useState([])
  const [journal, setJournal]       = useState([])
  const [homework, setHomework]     = useState({ assignment: '', submissions: [] })
  const [tab, setTab]               = useState('attendance')
  const [loading, setLoading]       = useState(true)

  const isTeacher = user?.role === 'teacher' && group?.teacher === user?.id

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGroup(groupId),
      getMembers(groupId),
      getAttendance(groupId, lessonId),
      getScores(groupId, lessonId),
      getJournal(groupId, lessonId),
      getHomework(groupId, lessonId),
    ]).then(([g, m, a, s, j, hw]) => {
      setGroup(g.data)
      setMembers(m.data)
      setAttendance(a.data)
      setScores(s.data)
      setJournal(j.data)
      setHomework(hw.data)
      getLessons(groupId).then(r => setLesson(r.data.find(l => String(l.id) === String(lessonId))))
    }).catch(() => show(t('lesson.toast_fail_load'), 'error'))
    .finally(() => setLoading(false))
  }, [groupId, lessonId])

  if (loading) return <Spinner />
  if (!group) return <p style={{ color: 'var(--text-muted)' }}>{t('lesson.toast_fail_load')}</p>

  const tabs = [
    { key: 'attendance', label: t('lesson.tab_attendance') },
    { key: 'scores',     label: t('lesson.tab_scores') },
    { key: 'journal',    label: t('lesson.tab_journal') },
    { key: 'homework',   label: t('lesson.tab_homework') },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link to="/groups" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('common.groups')}</Link>
        <ChevronRight size={14} />
        <Link to={`/groups/${groupId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{group.name}</Link>
        <ChevronRight size={14} />
        <span>{lesson?.title || 'Lesson'}</span>
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{lesson?.title}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        {lesson ? new Date(lesson.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(item => (
          <button key={item.key} className="tab-btn" onClick={() => setTab(item.key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
            color: tab === item.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === item.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s', flexShrink: 0,
          }}>{item.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'attendance' && (
            <AttendanceTab members={members} attendance={attendance} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setAttendance} />
          )}
          {tab === 'scores' && (
            <ScoresTab members={members} scores={scores} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setScores} />
          )}
          {tab === 'journal' && (
            <JournalTab journal={journal} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setJournal} />
          )}
          {tab === 'homework' && (
            <HomeworkTab homework={homework} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setHomework} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Attendance ────────────────────────────────────────────────────────────────

function AttendanceTab({ members, attendance, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [local, setLocal]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map = {}
    attendance.forEach(a => { map[a.student] = a.present })
    members.forEach(m => { if (!(m.id in map)) map[m.id] = false })
    setLocal(map)
  }, [attendance, members])

  const toggle = id => setLocal(l => ({ ...l, [id]: !l[id] }))

  const save = async () => {
    setSaving(true)
    try {
      const records = Object.entries(local).map(([student, present]) => ({ student: Number(student), present }))
      const { data } = await saveAttendance(groupId, lessonId, records)
      onSaved(data)
      show(t('lesson.toast_attendance'), 'success')
    } catch { show(t('lesson.toast_fail_attendance'), 'error') }
    finally { setSaving(false) }
  }

  const presentCount = Object.values(local).filter(Boolean).length
  const total        = members.length

  return (
    <div>
      <div className="stats-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label={t('lesson.present')} value={presentCount}          color="var(--success)" />
          <Stat label={t('lesson.absent')}  value={total - presentCount}  color="var(--danger)" />
          <Stat label={t('lesson.total')}   value={total}                 color="var(--text-muted)" />
        </div>
        {isTeacher && (
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
            {saving ? t('lesson.saving') : t('lesson.save')}
          </motion.button>
        )}
      </div>

      {members.length === 0 ? <EmptyTab icon={Users} text={t('lesson.no_students')} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m, i) => {
            const present = local[m.id] ?? false
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px', transition: 'border-color 0.2s' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: present ? 'rgba(5,150,105,0.12)' : 'var(--bg)', border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: present ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0, transition: 'all 0.2s' }}>
                  {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.first_name} {m.last_name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{m.username}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: present ? 'var(--success)' : 'var(--danger)' }}>
                    {present ? t('lesson.present') : t('lesson.absent')}
                  </span>
                  {isTeacher && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggle(m.id)}
                      style={{ width: 32, height: 32, borderRadius: 7, border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, background: present ? 'rgba(5,150,105,0.12)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.17s' }}>
                      <CheckSquare size={16} color={present ? 'var(--success)' : 'var(--text-muted)'} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Scores ────────────────────────────────────────────────────────────────────

function ScoresTab({ members, scores, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [local, setLocal]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map = {}
    scores.forEach(s => { map[s.student] = s.value })
    members.forEach(m => { if (!(m.id in map)) map[m.id] = '' })
    setLocal(map)
  }, [scores, members])

  const set = (id, val) => {
    const n = Number(val)
    if (val === '' || (n >= 0 && n <= 5)) setLocal(l => ({ ...l, [id]: val === '' ? '' : n }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const records = Object.entries(local)
        .filter(([, v]) => v !== '')
        .map(([student, value]) => ({ student: Number(student), value: Number(value) }))
      const { data } = await saveScores(groupId, lessonId, records)
      onSaved(data)
      show(t('lesson.toast_scores'), 'success')
    } catch { show(t('lesson.toast_fail_scores'), 'error') }
    finally { setSaving(false) }
  }

  const filled = Object.values(local).filter(v => v !== '').length
  const avg    = filled ? (Object.values(local).filter(v => v !== '').reduce((a, b) => a + Number(b), 0) / filled).toFixed(1) : '—'

  return (
    <div>
      <div className="stats-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label={t('lesson.scored')}  value={filled} color="var(--accent)" />
          <Stat label={t('lesson.average')} value={avg}    color="var(--warning)" />
        </div>
        {isTeacher && (
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
            {saving ? t('lesson.saving') : t('lesson.save_scores')}
          </motion.button>
        )}
      </div>

      {members.length === 0 ? <EmptyTab icon={Users} text={t('lesson.no_students')} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m, i) => {
            const score = local[m.id] ?? ''
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>
                  {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.first_name} {m.last_name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{m.username}</p>
                </div>
                {isTeacher ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {[0,1,2,3,4,5].map(n => (
                      <motion.button key={n} whileTap={{ scale: 0.85 }} onClick={() => set(m.id, score === n ? '' : n)}
                        style={{ width: 36, height: 36, borderRadius: 7, border: `1.5px solid ${score === n ? 'var(--accent)' : 'var(--border)'}`, background: score === n ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: score === n ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}>
                        {n}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={16} color="var(--warning)" fill={score !== '' ? 'var(--warning)' : 'none'} />
                    <span style={{ fontWeight: 700, fontSize: 18, color: score !== '' ? 'var(--text)' : 'var(--text-muted)' }}>
                      {score !== '' ? score : '—'}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/5</span>
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────────────────────

function JournalTab({ journal, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [body, setBody]     = useState(journal[0]?.body || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!isTeacher) setBody(journal[0]?.body || '') }, [journal])

  const save = async () => {
    if (!body.trim()) { show(t('lesson.err_journal_empty'), 'error'); return }
    setSaving(true)
    try {
      const { data } = await saveJournal(groupId, lessonId, body)
      onSaved([data])
      show(t('lesson.toast_journal'), 'success')
    } catch { show(t('lesson.toast_fail_journal'), 'error') }
    finally { setSaving(false) }
  }

  const suffix = journal.length === 1 ? t('lesson.entry') : t('lesson.entries')

  if (isTeacher) {
    return (
      <div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{journal.length} {suffix} {t('lesson.entries_count').split(' ').slice(-1)[0]}</p>
        {journal.length === 0 ? <EmptyTab icon={BookOpen} text={t('lesson.no_journals')} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {journal.map((j, i) => (
              <motion.div key={j.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                    {j.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{j.student_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(j.updated_at).toLocaleString()}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{j.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('lesson.journal_hint')}
      </p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={t('lesson.journal_placeholder')}
        rows={8}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
          {saving ? t('lesson.saving') : journal.length ? t('lesson.update_journal') : t('lesson.submit_journal')}
        </motion.button>
      </div>
    </div>
  )
}

// ── Homework ──────────────────────────────────────────────────────────────────

function HomeworkTab({ homework, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [assignment, setAssignment] = useState(homework.assignment || '')
  const [body, setBody]             = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savingSubmission, setSavingSubmission] = useState(false)

  useEffect(() => {
    setAssignment(homework.assignment || '')
    if (!isTeacher) setBody(homework.submissions[0]?.body || '')
  }, [homework])

  const saveAssignment = async () => {
    setSavingAssignment(true)
    try {
      const { data } = await setHomeworkAssignment(groupId, lessonId, assignment)
      onSaved(hw => ({ ...hw, assignment: data.assignment }))
      show(t('lesson.toast_homework_saved'), 'success')
    } catch { show(t('lesson.toast_fail_homework'), 'error') }
    finally { setSavingAssignment(false) }
  }

  const submitHomework = async () => {
    if (!body.trim()) { show(t('lesson.err_homework_empty'), 'error'); return }
    setSavingSubmission(true)
    try {
      const { data } = await saveHomework(groupId, lessonId, body)
      onSaved(hw => ({ ...hw, submissions: [data] }))
      show(t('lesson.toast_homework_submitted'), 'success')
    } catch { show(t('lesson.toast_fail_homework'), 'error') }
    finally { setSavingSubmission(false) }
  }

  if (isTeacher) {
    return (
      <div style={{ maxWidth: 720 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('lesson.homework_assignment_hint')}</p>
        <textarea
          value={assignment}
          onChange={e => setAssignment(e.target.value)}
          placeholder={t('lesson.homework_assignment_placeholder')}
          rows={5}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 32 }}>
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={saveAssignment} disabled={savingAssignment}
            style={{ ...primaryBtn, opacity: savingAssignment ? 0.7 : 1 }}>
            {savingAssignment ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
            {savingAssignment ? t('lesson.saving') : t('lesson.save_assignment')}
          </motion.button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          {homework.submissions.length} {t('lesson.submissions_count')}
        </p>
        {homework.submissions.length === 0 ? (
          <EmptyTab icon={ClipboardList} text={t('lesson.no_submissions')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {homework.submissions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                    {s.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{s.student_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.submitted_at).toLocaleString()}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{s.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {assignment ? (
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('lesson.assignment')}</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{assignment}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('lesson.no_assignment_yet')}</p>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('lesson.homework_hint')}</p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={t('lesson.homework_placeholder')}
        rows={7}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={submitHomework} disabled={savingSubmission}
          style={{ ...primaryBtn, opacity: savingSubmission ? 0.7 : 1 }}>
          {savingSubmission ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
          {savingSubmission ? t('lesson.saving') : homework.submissions.length ? t('lesson.update_homework') : t('lesson.submit_homework')}
        </motion.button>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', minWidth: 64 }}>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
    </div>
  )
}

function EmptyTab({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 48, height: 48, background: 'var(--accent-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={22} color="var(--accent)" />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{text}</p>
    </div>
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

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
