import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Building2, Link2, Plus, Copy, Check, Trash2,
  Loader2, Upload, Users, GraduationCap,
  Clock, Hash, Shield, Sparkles, AlertCircle, UserX,
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ALL_TABS = [
  { id: 'academy', icon: Building2, roles: ['admin', 'teacher', 'student', 'parent'] },
  { id: 'members', icon: Users,     roles: ['admin', 'teacher'] },
  { id: 'invites', icon: Link2,     roles: ['admin', 'teacher'] },
]

const ROLE_OPTION_DEFS = [
  { value: 'student', icon: GraduationCap, color: '#14B8A8' },
  { value: 'teacher', icon: Users,          color: '#8B5CF6' },
  { value: 'admin',   icon: Shield,         color: '#F59E0B' },
  { value: 'parent',  icon: Users,          color: '#EC4899' },
]

const ROLE_OPTIONS_BY_ROLE = {
  admin:   ['student', 'teacher', 'admin', 'parent'],
  teacher: ['student', 'parent'],
}

const PRESET_COLORS = [
  '#0D9488', '#14B8A8', '#8B5CF6', '#6366F1',
  '#F59E0B', '#EF4444', '#EC4899', '#10B981',
  '#3B82F6', '#F97316', '#64748B', '#1E293B',
]

function CopyButton({ text }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
        background: copied ? 'rgba(20,184,168,0.1)' : 'rgba(0,0,0,0.04)',
        color: copied ? '#0D9488' : 'rgba(30,41,59,0.6)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
      }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t('groups.copied') : t('groups.copy')}
    </button>
  )
}

// ── Create Academy ─────────────────────────────────────────────────────────────
function CreateAcademy({ onCreated }) {
  const { t } = useTranslation()
  const { show }  = useToast()
  const { setUser, user } = useAuth()
  const [form, setForm]   = useState({ name: '', primary_color: '#0D9488' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: t('settings.err_name_required') }); return }
    setLoading(true)
    try {
      const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data } = await api.post('/academy/create/', { ...form, slug })
      const { data: me } = await api.get('/auth/me/')
      setUser(me)
      show(`${data.name} created!`, 'success')
      onCreated(data)
    } catch (err) {
      const d = err.response?.data
      if (typeof d === 'object') {
        const mapped = {}
        Object.entries(d).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v })
        setErrors(mapped)
      } else {
        show(t('settings.err_save'), 'error')
      }
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          boxShadow: '0 8px 32px rgba(20,184,168,0.3)',
        }}>
          <Building2 size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          {t('settings.create_academy_title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {t('settings.create_academy_sub')}
        </p>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>{t('settings.academy_name')}</label>
            <input
              style={{ ...inputStyle(!!errors.name) }}
              placeholder={t('settings.academy_name_placeholder')}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors({}) }}
            />
            {errors.name && <p style={errStyle}>{errors.name}</p>}
          </div>

          <div>
            <label style={labelStyle}>{t('settings.brand_color')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                  style={{
                    width: 32, height: 32, borderRadius: 8, background: c, border: 'none',
                    cursor: 'pointer', outline: form.primary_color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, transition: 'transform 0.15s',
                    transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: form.primary_color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
              <input type="color" value={form.primary_color}
                onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', padding: 2, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{form.primary_color}</span>
            </div>
          </div>

          <motion.button type="submit" disabled={loading}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            style={{
              padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
              color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(20,184,168,0.3)',
            }}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.creating')}</>
              : <><Sparkles size={16} /> {t('settings.create_btn')}</>
            }
          </motion.button>
        </form>
      </div>
    </motion.div>
  )
}

// ── Academy Tab ────────────────────────────────────────────────────────────────
function AcademyTab({ academy, onUpdated }) {
  const { t } = useTranslation()
  const { show }  = useToast()
  const logoRef   = useRef()
  const [form, setForm]       = useState({ name: academy.name, primary_color: academy.primary_color })
  const [loading, setLoading] = useState(false)
  const [logoLoading, setLogoLoading] = useState(false)
  const [saved, setSaved]     = useState(false)

  const save = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.patch('/academy/', form)
      onUpdated(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      show(t('settings.err_save'), 'error')
    } finally { setLoading(false) }
  }

  const uploadLogo = async file => {
    setLogoLoading(true)
    const fd = new FormData()
    fd.append('logo', file)
    try {
      // Do NOT set Content-Type manually — browser must set it with the boundary
      const { data } = await api.patch('/academy/', fd)
      onUpdated(data)
      show(t('settings.logo_updated'), 'success')
    } catch {
      show(t('settings.err_logo_upload'), 'error')
    } finally { setLogoLoading(false) }
  }

  const removeLogo = async () => {
    setLogoLoading(true)
    try {
      const { data } = await api.delete('/academy/logo/')
      onUpdated(data)
      show(t('settings.logo_removed'), 'success')
    } catch {
      show(t('settings.err_logo_remove'), 'error')
    } finally { setLogoLoading(false) }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Logo */}
      <div>
        <label style={labelStyle}>{t('settings.academy_logo')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 18,
            background: academy.logo_url
              ? 'transparent'
              : `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(0,0,0,0.08)', overflow: 'hidden', flexShrink: 0,
          }}>
            {academy.logo_url
              ? <img src={academy.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Building2 size={30} color="#fff" />
            }
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && uploadLogo(e.target.files[0])} />
            <button type="button" onClick={() => logoRef.current.click()} disabled={logoLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)',
                background: 'transparent', color: 'var(--text)', fontSize: 13,
                fontWeight: 600, cursor: logoLoading ? 'not-allowed' : 'pointer',
              }}>
              {logoLoading
                ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                : <Upload size={14} />
              }
              {academy.logo_url ? t('settings.change_logo') : t('settings.upload_logo')}
            </button>
            {academy.logo_url && (
              <button type="button" onClick={removeLogo} disabled={logoLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                  borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.05)', color: '#EF4444', fontSize: 13,
                  fontWeight: 600, cursor: logoLoading ? 'not-allowed' : 'pointer',
                }}>
                <Trash2 size={14} />
                {t('settings.remove_logo')}
              </button>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.logo_hint')}</p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label style={labelStyle}>{t('settings.academy_name')}</label>
        <input style={inputStyle(false)} value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      {/* Color */}
      <div>
        <label style={labelStyle}>{t('settings.brand_color')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, primary_color: c }))}
              style={{
                width: 32, height: 32, borderRadius: 8, background: c, border: 'none',
                cursor: 'pointer', outline: form.primary_color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2, transition: 'transform 0.15s',
                transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
              }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: form.primary_color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
          <input type="color" value={form.primary_color}
            onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
            style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', padding: 2, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{form.primary_color}</span>
        </div>

        {/* Live preview */}
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 14,
          background: `linear-gradient(135deg, ${form.primary_color}22, ${form.primary_color}11)`,
          border: `1.5px solid ${form.primary_color}44`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: form.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: form.primary_color }}>{form.name || t('settings.academy_name')}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.invite_preview')}</p>
          </div>
        </div>
      </div>

      <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        style={{
          padding: '13px', borderRadius: 12, border: 'none',
          background: saved
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}cc)`,
          color: '#fff', fontWeight: 800, fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.3s',
        }}>
        {loading
          ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.saving')}</>
          : saved
            ? <><Check size={15} /> {t('settings.saved')}</>
            : t('settings.save_changes')
        }
      </motion.button>
    </form>
  )
}

// ── Members Tab ────────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  admin:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  teacher: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  student: { color: '#14B8A8', bg: 'rgba(20,184,168,0.12)' },
  parent:  { color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
}

function MembersTab({ userRole }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [removing, setRemoving]   = useState(null)
  const [search, setSearch]       = useState('')
  const [linking, setLinking]     = useState(null)   // parent member id being linked
  const [linkStudent, setLinkStudent] = useState('')
  const [linkSaving, setLinkSaving]   = useState(false)

  useEffect(() => {
    api.get('/academy/members/')
      .then(r => setMembers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const removeMember = async (member) => {
    const name = member.first_name || member.username
    if (!window.confirm(t('settings.remove_confirm', { name }))) return
    setRemoving(member.id)
    try {
      await api.delete(`/academy/members/${member.id}/`)
      setMembers(prev => prev.filter(m => m.id !== member.id))
      show(t('settings.member_removed'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('settings.err_remove_member'), 'error')
    } finally { setRemoving(null) }
  }

  const canRemove = (member) => {
    if (member.role === 'admin') return userRole === 'admin'
    if (member.role === 'teacher') return userRole === 'admin'
    return true // student/parent: both admin and teacher can remove
  }

  const linkChild = async (parentId) => {
    if (!linkStudent) return
    setLinkSaving(true)
    try {
      await api.post('/auth/link-child/', { parent: parentId, student: linkStudent })
      show(t('settings.child_linked'), 'success')
      setLinking(null)
      setLinkStudent('')
    } catch (err) {
      show(err.response?.data?.detail || t('settings.err_link_child'), 'error')
    } finally { setLinkSaving(false) }
  }

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name} ${m.username} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Loader2 size={24} style={{ color: '#14B8A8', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <input
        placeholder={t('settings.search_members')}
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle(false), fontSize: 14 }}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>{search ? t('settings.no_results') : t('settings.no_members')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.no_members_sub')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(m => {
            const badge = ROLE_BADGE[m.role] || ROLE_BADGE.student
            const initials = (m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()
            return (
              <motion.div key={m.id} layout
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${badge.color}, ${badge.color}bb)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: '#fff',
                }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {m.first_name ? `${m.first_name} ${m.last_name}` : m.username}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: badge.bg, color: badge.color,
                    }}>
                      {t(`settings.role_${m.role}`, { defaultValue: m.role })}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    @{m.username}
                    {m.invited_by && (
                      <span> · {t('settings.invited_by')} <strong>{m.invited_by.first_name || m.invited_by.username}</strong></span>
                    )}
                  </p>
                </div>

                {/* Joined date */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                  {new Date(m.date_joined).toLocaleDateString()}
                </div>

                {/* Link child button (parents only) */}
                {m.role === 'parent' && (
                  linking === m.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <select value={linkStudent} onChange={e => setLinkStudent(e.target.value)}
                        style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', maxWidth: 140 }}>
                        <option value="">{t('settings.pick_student')}</option>
                        {members.filter(s => s.role === 'student').map(s => (
                          <option key={s.id} value={s.id}>{s.first_name ? `${s.first_name} ${s.last_name}` : s.username}</option>
                        ))}
                      </select>
                      <button onClick={() => linkChild(m.id)} disabled={!linkStudent || linkSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#EC4899', color: '#fff', fontSize: 12, fontWeight: 700, cursor: (!linkStudent || linkSaving) ? 'not-allowed' : 'pointer', opacity: (!linkStudent || linkSaving) ? 0.6 : 1 }}>
                        {linkSaving ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : t('settings.link')}
                      </button>
                      <button onClick={() => { setLinking(null); setLinkStudent('') }}
                        style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setLinking(m.id); setLinkStudent('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                        borderRadius: 9, border: '1px solid rgba(236,72,153,0.25)',
                        background: 'rgba(236,72,153,0.07)', color: '#EC4899',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}>
                      + {t('settings.link_child')}
                    </button>
                  )
                )}

                {/* Remove button */}
                {canRemove(m) && (
                  <button onClick={() => removeMember(m)} disabled={removing === m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                      borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.06)', color: '#EF4444',
                      fontSize: 12, fontWeight: 600, cursor: removing === m.id ? 'not-allowed' : 'pointer',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
                    {removing === m.id
                      ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />
                      : <UserX size={12} />
                    }
                    {t('settings.remove')}
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Invites Tab ────────────────────────────────────────────────────────────────
function InvitesTab({ academy, userRole }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [invites, setInvites]   = useState([])
  const [groups, setGroups]     = useState([])
  const [students, setStudents] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: 'student', group: '', student: '', max_uses: 1, days_valid: 7, note: '' })

  const allowedRoleDefs = ROLE_OPTION_DEFS.filter(r =>
    (ROLE_OPTIONS_BY_ROLE[userRole] || ['student', 'parent']).includes(r.value)
  )

  useEffect(() => {
    Promise.all([
      api.get('/invites/').catch(() => ({ data: [] })),
      api.get('/groups/').catch(() => ({ data: [] })),
      api.get('/academy/members/').catch(() => ({ data: [] })),
    ]).then(([inv, grp, mem]) => {
      setInvites(inv.data)
      setGroups(grp.data)
      setStudents((mem.data || []).filter(m => m.role === 'student'))
    }).finally(() => setLoadingList(false))
  }, [])

  const createInvite = async e => {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { ...form, max_uses: Number(form.max_uses), days_valid: Number(form.days_valid) }
      if (!payload.group) delete payload.group
      if (payload.role !== 'parent' || !payload.student) delete payload.student
      const { data } = await api.post('/invites/create/', payload)
      setInvites(prev => [data, ...prev])
      setShowForm(false)
      setForm({ role: 'student', group: '', student: '', max_uses: 1, days_valid: 7, note: '' })
      show(t('settings.invite_created'), 'success')
    } catch {
      show(t('settings.err_invite_create'), 'error')
    } finally { setCreating(false) }
  }

  const inviteUrl = token => `${window.location.origin}/invite/${token}`

  const color = academy.primary_color || '#0D9488'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Create button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            background: showForm ? 'rgba(0,0,0,0.06)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: showForm ? 'var(--text)' : '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: showForm ? 'none' : `0 4px 16px ${color}44`,
          }}>
          <Plus size={15} />
          {t('settings.new_invite')}
        </motion.button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }}
            style={{ background: 'var(--card)', borderRadius: 16, border: `1.5px solid ${color}44`, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 18 }}>{t('settings.generate_invite')}</h3>
            <form onSubmit={createInvite} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Role picker */}
              <div>
                <label style={labelStyle}>{t('settings.role')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allowedRoleDefs.length}, 1fr)`, gap: 8 }}>
                  {allowedRoleDefs.map(r => (
                    <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, role: r.value }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${form.role === r.value ? r.color : 'rgba(0,0,0,0.1)'}`,
                        background: form.role === r.value ? `${r.color}15` : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <r.icon size={16} style={{ color: form.role === r.value ? r.color : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: form.role === r.value ? r.color : 'var(--text-muted)' }}>
                        {t(`settings.role_${r.value}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Max uses */}
                <div>
                  <label style={labelStyle}><Hash size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('settings.max_uses')}</label>
                  <input type="number" min="1" max="500" style={inputStyle(false)}
                    value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
                </div>

                {/* Days valid */}
                <div>
                  <label style={labelStyle}><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('settings.valid_days')}</label>
                  <input type="number" min="1" max="365" style={inputStyle(false)}
                    value={form.days_valid} onChange={e => setForm(f => ({ ...f, days_valid: e.target.value }))} />
                </div>
              </div>

              {/* Group (optional, students only) */}
              {groups.length > 0 && form.role === 'student' && (
                <div>
                  <label style={labelStyle}>{t('settings.autojoin_group')}</label>
                  <select style={{ ...inputStyle(false), appearance: 'none' }}
                    value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">{t('settings.no_group')}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}

              {/* Student link (parents only) */}
              {form.role === 'parent' && (
                <div>
                  <label style={labelStyle}>{t('settings.link_student')}</label>
                  <select style={{ ...inputStyle(false), appearance: 'none' }}
                    value={form.student} onChange={e => setForm(f => ({ ...f, student: e.target.value }))}>
                    <option value="">{t('settings.no_student')}</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {(s.first_name || s.last_name) ? `${s.first_name} ${s.last_name}`.trim() : s.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note */}
              <div>
                <label style={labelStyle}>{t('settings.invite_note')}</label>
                <input style={inputStyle(false)} placeholder={t('settings.invite_note_placeholder')}
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button type="submit" disabled={creating} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {creating
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.creating')}</>
                    : <><Link2 size={14} /> {t('settings.create_link')}</>
                  }
                </motion.button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  {t('settings.cancel')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite list */}
      {loadingList ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} style={{ color, animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : invites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Link2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
          <p style={{ fontWeight: 600 }}>{t('settings.no_invites')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.no_invites_sub')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invites.map(inv => {
            const roleDef  = ROLE_OPTION_DEFS.find(r => r.value === inv.role) || ROLE_OPTION_DEFS[0]
            const expired  = !inv.is_valid
            const usedUp   = inv.use_count >= inv.max_uses
            const url      = inviteUrl(inv.token)
            return (
              <motion.div key={inv.id} layout
                style={{
                  padding: '14px 18px', borderRadius: 14,
                  border: `1px solid ${expired || usedUp ? 'rgba(0,0,0,0.08)' : roleDef.color + '33'}`,
                  background: expired || usedUp ? 'rgba(0,0,0,0.02)' : `${roleDef.color}08`,
                  opacity: expired || usedUp ? 0.6 : 1,
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: expired || usedUp ? 'rgba(0,0,0,0.06)' : `${roleDef.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <roleDef.icon size={16} style={{ color: expired || usedUp ? 'var(--text-muted)' : roleDef.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: expired || usedUp ? 'var(--text-muted)' : roleDef.color }}>
                        {t(`settings.role_${inv.role}`, { defaultValue: inv.role })}
                      </span>
                      {inv.group && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>{t('settings.group_attached')}</span>}
                      {inv.student_name && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(236,72,153,0.1)', color: '#EC4899' }}>👤 {inv.student_name}</span>}
                      {(expired || usedUp) && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                          {usedUp ? t('settings.used_up') : t('settings.expired')}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {url}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={10} /> {inv.use_count}/{inv.max_uses} {t('settings.used')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {t('settings.expires')} {new Date(inv.expires_at).toLocaleDateString()}
                      </span>
                      {inv.note && <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>"{inv.note}"</span>}
                    </div>
                  </div>
                  {!expired && !usedUp && <CopyButton text={url} />}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('academy')
  const [academy, setAcademy]     = useState(null)
  const [fetched, setFetched]     = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.academy) {
      api.get('/academy/')
        .then(r => setAcademy(r.data))
        .catch(() => {})
        .finally(() => setFetched(true))
    } else {
      setFetched(true)
    }
  }, [user?.id])

  if (!user) return null

  if (!fetched) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} style={{ color: '#14B8A8', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // No academy yet
  if (!academy) {
    return (
      <>
        <CreateAcademy onCreated={data => setAcademy(data)} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

  const color = academy.primary_color || '#14B8A8'
  const TABS = ALL_TABS.filter(t => t.roles.includes(user.role))

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: `0 4px 16px ${color}44`,
          }}>
            {academy.logo_url
              ? <img src={academy.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
              : <Building2 size={22} color="#fff" />
            }
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{academy.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {t(`settings.role_${user.role}`, { defaultValue: user.role })} · {t('nav.settings')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              boxShadow: activeTab === tab.id ? `0 2px 10px ${color}44` : 'none',
            }}>
            <tab.icon size={14} />
            {t(`settings.tab_${tab.id}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'academy' && (
            <motion.div key="academy" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              {user.role === 'admin'
                ? <AcademyTab academy={academy} onUpdated={setAcademy} />
                : <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600 }}>{t('settings.admin_only')}</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.admin_only_sub')}</p>
                  </div>
              }
            </motion.div>
          )}
          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              <MembersTab userRole={user.role} />
            </motion.div>
          )}
          {activeTab === 'invites' && (
            <motion.div key="invites" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              <InvitesTab academy={academy} userRole={user.role} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 7,
}

const inputStyle = hasErr => ({
  width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
  background: 'var(--input-bg, rgba(0,0,0,0.04))',
  border: `1.5px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'var(--border, rgba(0,0,0,0.1))'}`,
  color: 'var(--text)', fontSize: 14, outline: 'none',
})

const errStyle = { fontSize: 11, color: '#f87171', marginTop: 4 }
