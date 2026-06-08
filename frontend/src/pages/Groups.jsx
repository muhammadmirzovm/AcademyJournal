import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Plus, Users, Key, Copy, Check, LogIn, BookOpen, Loader2 } from 'lucide-react'
import { getGroups, createGroup, joinGroup } from '../api/groups'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { CardSkeleton } from '../components/ui/Skeleton'

export default function Groups() {
  const { user } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin'

  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)

  const load = () => {
    setLoading(true)
    getGroups().then(r => setGroups(r.data)).catch(() => show(t('groups.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('groups.title')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{isTeacher ? t('groups.teacher_sub') : t('groups.student_sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isTeacher ? (
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)} style={primaryBtn}>
              <Plus size={15} /> {t('groups.new_group')}
            </motion.button>
          ) : (
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowJoin(true)} style={primaryBtn}>
              <LogIn size={15} /> {t('groups.join_group')}
            </motion.button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState isTeacher={isTeacher} onAction={() => isTeacher ? setShowCreate(true) : setShowJoin(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {groups.map((g, i) => <GroupCard key={g.id} group={g} index={i} isTeacher={isTeacher} />)}
        </div>
      )}

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={g => { setGroups(gs => [g, ...gs]); setShowCreate(false); show(t('groups.toast_created'), 'success') }} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)}
        onJoined={g => { setGroups(gs => [g, ...gs]); setShowJoin(false); show(t('groups.toast_joined', { name: g.name }), 'success') }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GroupCard({ group, index, isTeacher }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = (e) => {
    e.preventDefault()
    navigator.clipboard.writeText(group.join_key)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 0.2s', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ height: 5, background: 'var(--accent)' }} />
      <div style={{ padding: '20px 20px 16px' }}>
        <Link to={`/groups/${group.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>{group.name}</h3>
          {group.description && <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{group.description}</p>}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {group.is_individual && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', letterSpacing: '0.04em' }}>
              INDIVIDUAL
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', marginBottom: isTeacher ? 14 : 0 }}>
          {!group.is_individual && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} />{group.member_count} {t('groups.students')}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={13} />{t('groups.teacher')}: {group.teacher_name}</span>
        </div>
        {isTeacher && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <Key size={12} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', letterSpacing: '0.1em' }}>{group.join_key}</span>
            </span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={copy}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: copied ? 'var(--success)' : 'var(--text-muted)', padding: 0 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t('groups.copied') : t('groups.copy')}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function EmptyState({ isTeacher, onAction }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
      <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Users size={28} color="var(--accent)" />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('groups.no_groups')}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        {isTeacher ? t('groups.no_groups_teacher') : t('groups.no_groups_student')}
      </p>
      <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={onAction} style={primaryBtn}>
        {isTeacher ? <><Plus size={14} /> {t('groups.create_group')}</> : <><LogIn size={14} /> {t('groups.join_group')}</>}
      </motion.button>
    </motion.div>
  )
}

const WEEKDAYS = [
  { label: 'Mo', value: 0 },
  { label: 'Tu', value: 1 },
  { label: 'We', value: 2 },
  { label: 'Th', value: 3 },
  { label: 'Fr', value: 4 },
  { label: 'Sa', value: 5 },
  { label: 'Su', value: 6 },
]

function CreateGroupModal({ open, onClose, onCreated }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', class_days: [], is_individual: false })
  const [error, setError] = useState('')

  const toggleDay = day => {
    setForm(f => ({
      ...f,
      class_days: f.class_days.includes(day)
        ? f.class_days.filter(d => d !== day)
        : [...f.class_days, day].sort((a, b) => a - b),
    }))
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('groups.err_name_required')); return }
    setLoading(true)
    try {
      const { data } = await createGroup(form)
      setForm({ name: '', description: '', class_days: [], is_individual: false })
      onCreated(data)
    } catch { show(t('groups.toast_create_fail'), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('groups.create_modal_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.group_name')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} placeholder={t('groups.group_name_placeholder')}
            value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('groups.description_optional')}</span></label>
          <textarea style={{ ...inputStyle(false), marginTop: 6, resize: 'vertical', minHeight: 80 }}
            placeholder={t('groups.description_placeholder')} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('groups.class_days')}</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS.map(day => {
              const active = form.class_days.includes(day.value)
              return (
                <button key={day.value} type="button" onClick={() => toggleDay(day.value)}
                  style={{
                    width: 38, height: 38, borderRadius: 9, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
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
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('groups.group_type')}</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[false, true].map(val => {
              const active = form.is_individual === val
              return (
                <button key={String(val)} type="button" onClick={() => setForm(f => ({ ...f, is_individual: val }))}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 500, fontSize: 13, textAlign: 'center',
                  }}>
                  {val ? t('groups.type_individual') : t('groups.type_group')}
                </button>
              )
            })}
          </div>
          {form.is_individual && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('groups.individual_hint')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('groups.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('groups.creating') : t('groups.create_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function JoinGroupModal({ open, onClose, onJoined }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [key, setKey]         = useState('')
  const [error, setError]     = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!key.trim()) { setError(t('groups.err_key_required')); return }
    setLoading(true)
    try {
      const { data } = await joinGroup(key.trim())
      setKey(''); onJoined(data)
    } catch (err) {
      setError(err.response?.data?.detail || t('groups.err_key_required'))
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('groups.join_modal_title')}>
      <form onSubmit={submit}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('groups.join_hint')}</p>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('groups.join_key')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: 16 }}
            placeholder={t('groups.join_key_placeholder')} maxLength={8}
            value={key} onChange={e => { setKey(e.target.value.toUpperCase()); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('groups.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('groups.joining') : t('groups.join_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn   = { padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const errorStyle = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }
const inputStyle = (hasError) => ({ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', display: 'block' })
