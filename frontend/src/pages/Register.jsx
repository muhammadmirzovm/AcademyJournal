import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GraduationCap, BookOpen, Eye, EyeOff, ArrowRight, Loader2, Code2 } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const inputStyle = (hasErr) => ({
  width: '100%', padding: '13px 16px', borderRadius: 12, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.8)',
  border: `1px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.1)'}`,
  color: '#1e293b', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
})

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{error}</p>}
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { show }  = useToast()
  const { t }     = useTranslation()

  const [role, setRole]               = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [form, setForm]               = useState({ first_name:'', last_name:'', username:'', email:'', password:'', confirm:'' })
  const [errors, setErrors]           = useState({})

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!role)                       e.role       = t('auth.err_role')
    if (!form.first_name)            e.first_name = t('auth.err_first_name')
    if (!form.username)              e.username   = t('auth.err_username')
    if (!form.email)                 e.email      = t('auth.err_email')
    if (form.password.length < 6)   e.password   = t('auth.err_password_len')
    if (!form.confirm)               e.confirm    = t('auth.err_confirm_required')
    else if (form.confirm !== form.password) e.confirm = t('auth.err_confirm_match')
    return e
  }

  const submit = async e => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setLoading(true)
    try {
      const { confirm: _, ...payload } = { ...form, role }
      const { data } = await api.post('/auth/register/', payload)
      login(data.tokens, data.user)
      show(t('auth.welcome_toast'), 'success')
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

  const focusTeal  = e => { e.target.style.borderColor = '#14B8A8' }
  const blurNormal = e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)' }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px'
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(20,184,168,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            boxShadow: '0 8px 32px rgba(20,184,168,0.35)'
          }}>
            <Code2 size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>{t('auth.create_account')}</h1>
          <p style={{ fontSize: 14, color: 'rgba(30,41,59,0.6)' }}>
            {t('auth.already_have')}{' '}
            <Link to="/login" style={{ color: '#14B8A8', fontWeight: 600, textDecoration: 'none' }}>
              {t('auth.sign_in_link')}
            </Link>
          </p>
        </div>

        {/* Form card */}
        <div style={{
          borderRadius: 24, border: '1px solid rgba(0,0,0,0.1)',
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)',
          padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.4)'
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Role picker */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(30,41,59,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {t('auth.i_am_a')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { value: 'teacher', label: t('auth.teacher'), icon: GraduationCap, desc: t('auth.teacher_desc') },
                  { value: 'student', label: t('auth.student'), icon: BookOpen,      desc: t('auth.student_desc') },
                ].map(r => (
                  <motion.button key={r.value} type="button"
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setRole(r.value); setErrors(e => ({ ...e, role: '' })) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '20px 16px', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                      border: `2px solid ${role === r.value ? 'rgba(20,184,168,0.6)' : 'rgba(0,0,0,0.1)'}`,
                      background: role === r.value ? 'rgba(20,184,168,0.2)' : 'rgba(255,255,255,0.8)',
                      color: role === r.value ? '#14B8A8' : 'rgba(30,41,59,0.6)',
                    }}
                  >
                    <r.icon size={22} />
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{r.label}</span>
                    <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.4, opacity: 0.7 }}>{r.desc}</span>
                  </motion.button>
                ))}
              </div>
              {errors.role && <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{errors.role}</p>}
            </div>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('auth.first_name')} error={errors.first_name}>
                <input style={inputStyle(!!errors.first_name)} placeholder="John"
                  value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  onFocus={focusTeal} onBlur={blurNormal} />
              </Field>
              <Field label={t('auth.last_name')} error={errors.last_name}>
                <input style={inputStyle(!!errors.last_name)} placeholder="Doe"
                  value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  onFocus={focusTeal} onBlur={blurNormal} />
              </Field>
            </div>

            <Field label={t('auth.username')} error={errors.username}>
              <input style={inputStyle(!!errors.username)} placeholder="johndoe"
                value={form.username} onChange={e => set('username', e.target.value)}
                autoComplete="username" onFocus={focusTeal} onBlur={blurNormal} />
            </Field>

            <Field label={t('auth.email')} error={errors.email}>
              <input type="email" style={inputStyle(!!errors.email)} placeholder="john@example.com"
                value={form.email} onChange={e => set('email', e.target.value)}
                autoComplete="email" onFocus={focusTeal} onBlur={blurNormal} />
            </Field>

            <Field label={t('auth.password')} error={errors.password}>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'}
                  style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
                  placeholder={t('auth.min_password')}
                  value={form.password} onChange={e => set('password', e.target.value)}
                  autoComplete="new-password" onFocus={focusTeal} onBlur={blurNormal} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(30,41,59,0.3)', padding: 4, display: 'flex' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Field label={t('auth.confirm_password')} error={errors.confirm}>
              <div style={{ position: 'relative' }}>
                <input type={showConfirm ? 'text' : 'password'}
                  style={{ ...inputStyle(!!errors.confirm), paddingRight: 44 }}
                  placeholder={t('auth.repeat_password')}
                  value={form.confirm} onChange={e => set('confirm', e.target.value)}
                  autoComplete="new-password" onFocus={focusTeal} onBlur={blurNormal} />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(30,41,59,0.3)', padding: 4, display: 'flex' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
              style={{
                width: '100%', padding: '14px 0', marginTop: 4, borderRadius: 14, border: 'none',
                fontWeight: 800, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
                boxShadow: '0 8px 24px rgba(20,184,168,0.3)',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />{t('auth.creating')}</>
                : <>{t('auth.create_btn')} <ArrowRight size={16} /></>
              }
            </motion.button>
          </form>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}