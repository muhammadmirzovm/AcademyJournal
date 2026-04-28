import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Zap, Loader2, ArrowRight } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [form, setForm]         = useState({ username: '', password: '' })
  const [errors, setErrors]     = useState({})

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '', general: '' })) }

  const submit = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.username) errs.username = t('auth.err_username_required')
    if (!form.password) errs.password = t('auth.err_password_required')
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const { data: tokens } = await api.post('/auth/login/', form)
      const { data: user }   = await api.get('/auth/me/', { headers: { Authorization: `Bearer ${tokens.access}` } })
      login(tokens, user)
      show(`${t('auth.welcome_back')}, ${user.first_name || user.username}!`, 'success')
      navigate('/dashboard')
    } catch (err) {
      setErrors({ general: err.response?.data?.detail || t('auth.err_invalid') })
    } finally { setLoading(false) }
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #0a0b14 0%, #0d0e1a 100%)', minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>

      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1 }}
        className="w-full max-w-[400px]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
            className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 items-center justify-center mb-5 shadow-xl shadow-violet-500/30"
          >
            <Zap size={28} className="text-white" fill="white" />
          </motion.div>
          <h1 className="text-3xl font-black text-white mb-1">{t('auth.welcome_back')}</h1>
          <p className="text-white/40 text-sm">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
              {t('auth.create_one')}
            </Link>
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-white/10 bg-white/4 backdrop-blur-sm p-8 shadow-2xl">
          {errors.general && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errors.general}
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                {t('auth.username')}
              </label>
              <input
                value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="johndoe" autoComplete="username" autoFocus
                className={`w-full px-4 py-3.5 rounded-xl bg-white/5 border text-white text-base placeholder-white/25 focus:outline-none transition-all ${
                  errors.username ? 'border-red-500/50' : 'border-white/10 focus:border-violet-400'
                }`}
              />
              {errors.username && <p className="text-xs text-red-400 mt-1">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder={t('auth.your_password')} autoComplete="current-password"
                  className={`w-full px-4 py-3.5 pr-12 rounded-xl bg-white/5 border text-white text-base placeholder-white/25 focus:outline-none transition-all ${
                    errors.password ? 'border-red-500/50' : 'border-white/10 focus:border-violet-400'
                  }`}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-0.5">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
              className="w-full py-4 mt-3 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2 text-base"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" />{t('auth.signing_in')}</>
                : <>{t('auth.sign_in_btn')} <ArrowRight size={15} /></>
              }
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
