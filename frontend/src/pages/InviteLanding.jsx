import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, Users, Sparkles, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ROLE_LABELS = { teacher: 'Teacher', student: 'Student', admin: 'Admin', parent: 'Parent' }
const ROLE_ICONS  = { teacher: GraduationCap, student: BookOpen, admin: Users, parent: Users }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export default function InviteLanding() {
  const { token }      = useParams()
  const navigate       = useNavigate()
  const { login, user } = useAuth()
  const { show }       = useToast()

  const [invite,  setInvite]  = useState(null)
  const [status,  setStatus]  = useState('loading') // loading | valid | invalid
  const [mode,    setMode]    = useState('choose')   // choose | register | login
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '' })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    api.get(`/invites/${token}/verify/`)
      .then(r => { setInvite(r.data); setStatus('valid') })
      .catch(() => setStatus('invalid'))
  }, [token])

  const color     = invite?.academy?.primary_color || '#0D9488'
  const colorRgb  = invite ? hexToRgb(color) : '13, 148, 136'
  const RoleIcon  = invite ? (ROLE_ICONS[invite.role] || GraduationCap) : GraduationCap

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const setL = (k, v) => { setLoginForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const acceptInvite = async () => {
    await api.post(`/invites/${token}/accept/`)
    const { data: me } = await api.get('/auth/me/')
    return me
  }

  const handleRegister = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.first_name) errs.first_name = 'Required'
    if (!form.username)   errs.username   = 'Required'
    if (!form.email)      errs.email      = 'Required'
    if (form.password.length < 6) errs.password = 'Min 6 characters'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const { data } = await api.post('/auth/register/', {
        ...form,
        role: invite.role,
      })
      login(data.tokens, data.user)
      const me = await acceptInvite()
      login({ access: localStorage.getItem('access'), refresh: localStorage.getItem('refresh') }, me)
      show(`Welcome to ${invite.academy.name}!`, 'success')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data
      if (typeof detail === 'object') {
        const mapped = {}
        Object.entries(detail).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v })
        setErrors(mapped)
      } else {
        show('Something went wrong. Please try again.', 'error')
      }
    } finally { setLoading(false) }
  }

  const handleLogin = async e => {
    e.preventDefault()
    const errs = {}
    if (!loginForm.username) errs.username = 'Required'
    if (!loginForm.password) errs.password = 'Required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const { data: tokens } = await api.post('/auth/login/', loginForm)
      login(tokens, {})
      const me = await acceptInvite()
      login(tokens, me)
      show(`Welcome to ${invite.academy.name}!`, 'success')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setErrors({ password: detail || 'Invalid credentials.' })
    } finally { setLoading(false) }
  }

  const handleAlreadyLoggedIn = async () => {
    if (!user) { setMode('choose'); return }
    setLoading(true)
    try {
      const me = await acceptInvite()
      login({ access: localStorage.getItem('access'), refresh: localStorage.getItem('refresh') }, me)
      show(`Welcome to ${invite.academy.name}!`, 'success')
      navigate('/dashboard')
    } catch (err) {
      show(err.response?.data?.detail || 'Could not accept invite.', 'error')
    } finally { setLoading(false) }
  }

  const inputStyle = hasErr => ({
    width: '100%', padding: '12px 16px', borderRadius: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.9)',
    border: `1.5px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'}`,
    color: '#1e293b', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
  })

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
        <Loader2 size={32} style={{ color: '#0D9488', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <AlertCircle size={40} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Invite Expired</h1>
          <p style={{ color: 'rgba(30,41,59,0.6)', marginBottom: 24, lineHeight: 1.6 }}>
            This invite link has expired or already reached its usage limit. Ask your teacher or admin for a new link.
          </p>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: '#ef4444', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            Go Home
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, rgba(${colorRgb},0.06) 0%, rgba(${colorRgb},0.02) 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 400,
        background: `radial-gradient(ellipse, rgba(${colorRgb},0.12) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460 }}>

        {/* Academy header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {invite.academy.logo_url ? (
            <img src={invite.academy.logo_url} alt={invite.academy.name}
              style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', marginBottom: 16, boxShadow: `0 8px 32px rgba(${colorRgb},0.3)` }} />
          ) : (
            <div style={{
              display: 'inline-flex', width: 72, height: 72, borderRadius: 18,
              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              boxShadow: `0 8px 32px rgba(${colorRgb},0.35)`,
            }}>
              <GraduationCap size={32} color="#fff" />
            </div>
          )}
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
            {invite.academy.name}
          </h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: `rgba(${colorRgb},0.12)`, color: color,
            fontSize: 13, fontWeight: 700,
          }}>
            <RoleIcon size={13} />
            You're invited as {ROLE_LABELS[invite.role]}
            {invite.group_name && ` · ${invite.group_name}`}
          </div>
          {invite.note && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(30,41,59,0.5)', fontStyle: 'italic' }}>
              "{invite.note}"
            </p>
          )}
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 24, border: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
          padding: 28, boxShadow: `0 24px 80px rgba(${colorRgb},0.12)`,
        }}>
          <AnimatePresence mode="wait">

            {/* Step: choose register or login */}
            {mode === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                {user ? (
                  <div style={{ textAlign: 'center' }}>
                    <CheckCircle2 size={36} color={color} style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 15, color: '#1e293b', marginBottom: 20 }}>
                      You're logged in as <strong>{user.username}</strong>. Accept this invite?
                    </p>
                    <button onClick={handleAlreadyLoggedIn} disabled={loading}
                      style={{
                        width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                      }}>
                      {loading ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Sparkles size={16} />}
                      Join {invite.academy.name}
                    </button>
                    <button onClick={() => { /* force re-login path */ setMode('login') }}
                      style={{ marginTop: 12, background: 'none', border: 'none', color: 'rgba(30,41,59,0.5)', cursor: 'pointer', fontSize: 13 }}>
                      Use a different account
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                      How would you like to join?
                    </p>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setMode('register')}
                      style={{
                        width: '100%', padding: '16px 20px', borderRadius: 16, border: 'none',
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                      }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div>Create new account</div>
                        <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>New to the platform? Start here</div>
                      </div>
                      <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
                    </motion.button>

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setMode('login')}
                      style={{
                        width: '100%', padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                        background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)',
                        color: '#1e293b', fontWeight: 700, fontSize: 15,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div>Sign in to existing account</div>
                        <div style={{ fontSize: 12, fontWeight: 400, color: 'rgba(30,41,59,0.5)' }}>Already have an account?</div>
                      </div>
                      <ArrowRight size={18} style={{ marginLeft: 'auto', color: 'rgba(30,41,59,0.3)' }} />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step: register */}
            {mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setMode('choose')}
                  style={{ background: 'none', border: 'none', color: 'rgba(30,41,59,0.4)', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ← Back
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Create your account</h2>
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>First name</label>
                      <input style={inputStyle(!!errors.first_name)} placeholder="John"
                        value={form.first_name} onChange={e => set('first_name', e.target.value)}
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                      {errors.first_name && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.first_name}</p>}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Last name</label>
                      <input style={inputStyle(false)} placeholder="Doe"
                        value={form.last_name} onChange={e => set('last_name', e.target.value)}
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Username</label>
                    <input style={inputStyle(!!errors.username)} placeholder="johndoe"
                      value={form.username} onChange={e => set('username', e.target.value)} autoComplete="username"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                    {errors.username && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.username}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Email</label>
                    <input type="email" style={inputStyle(!!errors.email)} placeholder="john@example.com"
                      value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                    {errors.email && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.email}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'}
                        style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
                        placeholder="Min 6 characters"
                        value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(30,41,59,0.3)', display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.password}</p>}
                  </div>
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{
                      width: '100%', padding: '14px 0', marginTop: 4, borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      color: '#fff', fontWeight: 800, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                    }}>
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Creating…</> : <>Join {invite.academy.name} <ArrowRight size={16} /></>}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* Step: login */}
            {mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setMode('choose')}
                  style={{ background: 'none', border: 'none', color: 'rgba(30,41,59,0.4)', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ← Back
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Sign in to join</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Username</label>
                    <input style={inputStyle(!!errors.username)} placeholder="johndoe"
                      value={loginForm.username} onChange={e => setL('username', e.target.value)} autoComplete="username"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                    {errors.username && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.username}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'}
                        style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
                        placeholder="Your password"
                        value={loginForm.password} onChange={e => setL('password', e.target.value)} autoComplete="current-password"
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'rgba(0,0,0,0.12)' }} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(30,41,59,0.3)', display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.password}</p>}
                  </div>
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{
                      width: '100%', padding: '14px 0', marginTop: 4, borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      color: '#fff', fontWeight: 800, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                    }}>
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Signing in…</> : <>Sign in &amp; Join <ArrowRight size={16} /></>}
                  </motion.button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(30,41,59,0.35)' }}>
          Powered by AcademyJournal
        </p>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
