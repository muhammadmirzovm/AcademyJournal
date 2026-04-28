import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GraduationCap, BookOpen, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const inputCls = (err) =>
  `w-full px-4 py-3.5 rounded-xl bg-white/5 border text-white text-base placeholder-white/25 focus:outline-none transition-all ${
    err ? 'border-red-500/50' : 'border-white/10 focus:border-violet-400'
  }`

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
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

  return (
    <div style={{ background: 'linear-gradient(135deg, #0a0b14 0%, #0d0e1a 100%)', minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>

      {/* Background */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1 }}
        className="w-full max-w-[460px]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 items-center justify-center mb-5 shadow-xl shadow-violet-500/30">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-1">{t('auth.create_account')}</h1>
          <p className="text-white/40 text-sm">
            {t('auth.already_have')}{' '}
            <Link to="/login" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
              {t('auth.sign_in_link')}
            </Link>
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-white/10 bg-white/4 backdrop-blur-sm p-8 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">

            {/* Role picker */}
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">{t('auth.i_am_a')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'teacher', label: t('auth.teacher'), icon: GraduationCap, desc: t('auth.teacher_desc') },
                  { value: 'student', label: t('auth.student'), icon: BookOpen,      desc: t('auth.student_desc') },
                ].map(r => (
                  <motion.button key={r.value} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setRole(r.value); setErrors(e => ({ ...e, role: '' })) }}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      role === r.value
                        ? 'border-violet-400/60 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-white/3 text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}
                  >
                    <r.icon size={22} />
                    <span className="font-black text-sm">{r.label}</span>
                    <span className="text-[11px] text-center leading-snug opacity-70">{r.desc}</span>
                  </motion.button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-red-400 mt-1">{errors.role}</p>}
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('auth.first_name')} error={errors.first_name}>
                <input className={inputCls(!!errors.first_name)} placeholder="John"
                  value={form.first_name} onChange={e => set('first_name', e.target.value)} />
              </Field>
              <Field label={t('auth.last_name')} error={errors.last_name}>
                <input className={inputCls(!!errors.last_name)} placeholder="Doe"
                  value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </Field>
            </div>

            <Field label={t('auth.username')} error={errors.username}>
              <input className={inputCls(!!errors.username)} placeholder="johndoe"
                value={form.username} onChange={e => set('username', e.target.value)} autoComplete="username" />
            </Field>

            <Field label={t('auth.email')} error={errors.email}>
              <input type="email" className={inputCls(!!errors.email)} placeholder="john@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
            </Field>

            <Field label={t('auth.password')} error={errors.password}>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'}
                  className={inputCls(!!errors.password) + ' pr-11'}
                  placeholder={t('auth.min_password')}
                  value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label={t('auth.confirm_password')} error={errors.confirm}>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'}
                  className={inputCls(!!errors.confirm) + ' pr-11'}
                  placeholder={t('auth.repeat_password')}
                  value={form.confirm} onChange={e => set('confirm', e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
              className="w-full py-4 mt-2 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2 text-base"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" />{t('auth.creating')}</>
                : <>{t('auth.create_btn')} <ArrowRight size={15} /></>
              }
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
