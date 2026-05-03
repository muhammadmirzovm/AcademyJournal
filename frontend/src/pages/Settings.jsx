import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Palette, Link2, Plus, Copy, Check, Trash2,
  Loader2, Upload, Users, GraduationCap, ChevronDown,
  Clock, Hash, Shield, Sparkles, AlertCircle,
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ALL_TABS = [
  { id: 'academy',  label: 'Academy',  icon: Building2, roles: ['admin', 'teacher', 'student', 'parent'] },
  { id: 'invites',  label: 'Invites',  icon: Link2,     roles: ['admin', 'teacher'] },
]

const ALL_ROLE_OPTIONS = [
  { value: 'student', label: 'Student',  icon: GraduationCap, color: '#14B8A8' },
  { value: 'teacher', label: 'Teacher',  icon: Users,          color: '#8B5CF6' },
  { value: 'admin',   label: 'Admin',    icon: Shield,         color: '#F59E0B' },
  { value: 'parent',  label: 'Parent',   icon: Users,          color: '#EC4899' },
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
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ── Create Academy ─────────────────────────────────────────────────────────────
function CreateAcademy({ onCreated }) {
  const { show }  = useToast()
  const { setUser, user } = useAuth()
  const [form, setForm]   = useState({ name: '', primary_color: '#0D9488' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: 'Academy name is required' }); return }
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
        show('Failed to create academy.', 'error')
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
          Create your Academy
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Set up your academy to invite teachers and students
        </p>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Academy Name</label>
            <input
              style={{ ...inputStyle(!!errors.name) }}
              placeholder="e.g. Bright Minds Academy"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors({}) }}
            />
            {errors.name && <p style={errStyle}>{errors.name}</p>}
          </div>

          <div>
            <label style={labelStyle}>Brand Color</label>
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
              ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Creating…</>
              : <><Sparkles size={16} /> Create Academy</>
            }
          </motion.button>
        </form>
      </div>
    </motion.div>
  )
}

// ── Academy Tab ────────────────────────────────────────────────────────────────
function AcademyTab({ academy, onUpdated }) {
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
      show('Failed to save changes.', 'error')
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
      show('Logo updated!', 'success')
    } catch {
      show('Failed to upload logo.', 'error')
    } finally { setLogoLoading(false) }
  }

  const removeLogo = async () => {
    setLogoLoading(true)
    try {
      const { data } = await api.delete('/academy/logo/')
      onUpdated(data)
      show('Logo removed.', 'success')
    } catch {
      show('Failed to remove logo.', 'error')
    } finally { setLogoLoading(false) }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Logo */}
      <div>
        <label style={labelStyle}>Academy Logo</label>
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
              {academy.logo_url ? 'Change Logo' : 'Upload Logo'}
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
                Remove Logo
              </button>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>PNG, JPG up to 2MB</p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label style={labelStyle}>Academy Name</label>
        <input style={inputStyle(false)} value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      {/* Color */}
      <div>
        <label style={labelStyle}>Brand Color</label>
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
            <p style={{ fontSize: 13, fontWeight: 700, color: form.primary_color }}>{form.name || 'Academy Name'}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invite page preview</p>
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
          ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
          : saved
            ? <><Check size={15} /> Saved!</>
            : 'Save Changes'
        }
      </motion.button>
    </form>
  )
}

// ── Invites Tab ────────────────────────────────────────────────────────────────
function InvitesTab({ academy, userRole }) {
  const { show } = useToast()
  const [invites, setInvites]   = useState([])
  const [groups, setGroups]     = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: 'student', group: '', max_uses: 1, days_valid: 7, note: '' })

  const allowedRoles = ALL_ROLE_OPTIONS.filter(r =>
    (ROLE_OPTIONS_BY_ROLE[userRole] || ['student', 'parent']).includes(r.value)
  )

  useEffect(() => {
    Promise.all([
      api.get('/invites/').catch(() => ({ data: [] })),
      api.get('/groups/').catch(() => ({ data: [] })),
    ]).then(([inv, grp]) => {
      setInvites(inv.data)
      setGroups(grp.data)
    }).finally(() => setLoadingList(false))
  }, [])

  const createInvite = async e => {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { ...form, max_uses: Number(form.max_uses), days_valid: Number(form.days_valid) }
      if (!payload.group) delete payload.group
      const { data } = await api.post('/invites/create/', payload)
      setInvites(prev => [data, ...prev])
      setShowForm(false)
      setForm({ role: 'student', group: '', max_uses: 1, days_valid: 7, note: '' })
      show('Invite link created!', 'success')
    } catch {
      show('Failed to create invite.', 'error')
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
          New Invite Link
        </motion.button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }}
            style={{ background: 'var(--card)', borderRadius: 16, border: `1.5px solid ${color}44`, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 18 }}>Generate Invite Link</h3>
            <form onSubmit={createInvite} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Role picker */}
              <div>
                <label style={labelStyle}>Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allowedRoles.length}, 1fr)`, gap: 8 }}>
                  {allowedRoles.map(r => (
                    <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, role: r.value }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${form.role === r.value ? r.color : 'rgba(0,0,0,0.1)'}`,
                        background: form.role === r.value ? `${r.color}15` : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <r.icon size={16} style={{ color: form.role === r.value ? r.color : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: form.role === r.value ? r.color : 'var(--text-muted)' }}>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Max uses */}
                <div>
                  <label style={labelStyle}><Hash size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Max Uses</label>
                  <input type="number" min="1" max="500" style={inputStyle(false)}
                    value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
                </div>

                {/* Days valid */}
                <div>
                  <label style={labelStyle}><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Valid (days)</label>
                  <input type="number" min="1" max="365" style={inputStyle(false)}
                    value={form.days_valid} onChange={e => setForm(f => ({ ...f, days_valid: e.target.value }))} />
                </div>
              </div>

              {/* Group (optional) */}
              {groups.length > 0 && form.role === 'student' && (
                <div>
                  <label style={labelStyle}>Auto-join Group (optional)</label>
                  <select style={{ ...inputStyle(false), appearance: 'none' }}
                    value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}

              {/* Note */}
              <div>
                <label style={labelStyle}>Note (shown on invite page)</label>
                <input style={inputStyle(false)} placeholder="e.g. Welcome to Spring 2025 class!"
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
                  {creating ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Creating…</> : <><Link2 size={14} /> Create Link</>}
                </motion.button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Cancel
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
          <p style={{ fontWeight: 600 }}>No invite links yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Create one above to invite people to your academy</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invites.map(inv => {
            const roleOpt  = ROLE_OPTIONS.find(r => r.value === inv.role) || ROLE_OPTIONS[0]
            const expired  = !inv.is_valid
            const usedUp   = inv.use_count >= inv.max_uses
            const url      = inviteUrl(inv.token)
            return (
              <motion.div key={inv.id} layout
                style={{
                  padding: '14px 18px', borderRadius: 14,
                  border: `1px solid ${expired || usedUp ? 'rgba(0,0,0,0.08)' : roleOpt.color + '33'}`,
                  background: expired || usedUp ? 'rgba(0,0,0,0.02)' : `${roleOpt.color}08`,
                  opacity: expired || usedUp ? 0.6 : 1,
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: expired || usedUp ? 'rgba(0,0,0,0.06)' : `${roleOpt.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <roleOpt.icon size={16} style={{ color: expired || usedUp ? 'var(--text-muted)' : roleOpt.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: expired || usedUp ? 'var(--text-muted)' : roleOpt.color, textTransform: 'capitalize' }}>
                        {inv.role}
                      </span>
                      {inv.group && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>Group attached</span>}
                      {(expired || usedUp) && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                          {usedUp ? 'Used up' : 'Expired'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {url}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={10} /> {inv.use_count}/{inv.max_uses} used
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> Expires {new Date(inv.expires_at).toLocaleDateString()}
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
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role} · Settings</p>
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
            {tab.label}
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
                    <p style={{ fontWeight: 600 }}>Admin only</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>Only academy admins can edit branding and settings</p>
                  </div>
              }
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
