import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Code2, Users, BarChart2, BookOpen, GraduationCap, ArrowRight,
  CheckCircle, LayoutDashboard, Star, Zap, ChevronDown, Trophy,
  ClipboardList, TrendingUp, Key, Gamepad2, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getOnlineCount, getPlatformStats } from '../api/users'

/* ── animation presets ───────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }

/* ── animated counter ───────────────────────────────────────────────── */
function Counter({ value, duration = 1400 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    if (!value) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setDisplay(Math.round(eased * value))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value, duration])

  return <span ref={ref}>{display.toLocaleString()}</span>
}

/* ── dashboard mockup ────────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', userSelect: 'none' }}>
      {/* Browser chrome */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#EF4444','#F59E0B','#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 5, padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 220, margin: '0 auto' }}>
          <ShieldCheck size={9} color="var(--accent)" /> codelearnmonday.vercel.app
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Top row - stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Avg Score', value: '4.2/5', color: '#22C55E', icon: <TrendingUp size={13} /> },
            { label: 'Attendance', value: '92%',   color: '#6366F1', icon: <CheckCircle size={13} /> },
            { label: 'Students',  value: '34',     color: '#F59E0B', icon: <Users size={13} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: s.color, marginBottom: 6 }}>
                {s.icon}
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Score trend chart (fake) */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Score Trend</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
            {[2, 3, 2.5, 4, 3.5, 4.2, 5, 4, 4.5, 4.8, 4.2, 5].map((v, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(16,185,129,${0.2 + (v / 5) * 0.7})`, borderRadius: '3px 3px 0 0', height: `${(v / 5) * 100}%`, transition: 'height 0.3s' }} />
            ))}
          </div>
        </div>

        {/* Student list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { name: 'Azizbek T.', score: 5, att: '✓', color: '#6366F1' },
            { name: 'Malika S.',  score: 4, att: '✓', color: '#F59E0B' },
            { name: 'Jasur R.',  score: 3, att: '✗', color: '#22C55E' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {s.name[0]}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: s.att === '✓' ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{s.att}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 7px', borderRadius: 5 }}>{s.score}/5</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── FAQ item ────────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }} style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.75, paddingBottom: 18 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── main component ──────────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth()
  const { t }    = useTranslation()

  const [onlineCount,    setOnlineCount]    = useState(null)
  const [platformStats,  setPlatformStats]  = useState(null)

  useEffect(() => {
    getOnlineCount().then(r => setOnlineCount(r.data.online)).catch(() => {})
    getPlatformStats().then(r => setPlatformStats(r.data)).catch(() => {})
  }, [])

  const features = [
    { icon: Users,         title: t('landing.feat_groups'),       desc: t('landing.feat_groups_desc') },
    { icon: BarChart2,     title: t('landing.feat_scores'),       desc: t('landing.feat_scores_desc') },
    { icon: CheckCircle,   title: t('landing.feat_attendance'),   desc: t('landing.feat_attendance_desc') },
    { icon: BookOpen,      title: t('landing.feat_journals'),     desc: t('landing.feat_journals_desc') },
    { icon: Code2,         title: t('landing.feat_charts'),       desc: t('landing.feat_charts_desc') },
    { icon: GraduationCap, title: t('landing.feat_profiles'),     desc: t('landing.feat_profiles_desc') },
    { icon: Star,          title: t('landing.feat_gamification'), desc: t('landing.feat_gamification_desc') },
  ]

  const steps = [
    { icon: <Key size={22} color="var(--accent)" />,          n: '01', title: t('landing.how_s1_title'), desc: t('landing.how_s1_desc') },
    { icon: <Users size={22} color="#6366F1" />,               n: '02', title: t('landing.how_s2_title'), desc: t('landing.how_s2_desc') },
    { icon: <TrendingUp size={22} color="#F59E0B" />,          n: '03', title: t('landing.how_s3_title'), desc: t('landing.how_s3_desc') },
  ]

  const gamePoints = [t('landing.game_p1'), t('landing.game_p2'), t('landing.game_p3'), t('landing.game_p4')]

  const faqs = [
    [t('landing.faq_q1'), t('landing.faq_a1')],
    [t('landing.faq_q2'), t('landing.faq_a2')],
    [t('landing.faq_q3'), t('landing.faq_a3')],
    [t('landing.faq_q4'), t('landing.faq_a4')],
    [t('landing.faq_q5'), t('landing.faq_a5')],
  ]

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', paddingTop: 56, paddingBottom: 80, minHeight: 'calc(100vh - 60px)' }}
        className="hero-grid">

        <div>
          {/* Badge */}
          <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-bg)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 99, padding: '5px 16px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {onlineCount === null ? t('landing.badge') : t('landing.online_users', { count: onlineCount })}
              </span>
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp}
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 800, lineHeight: 1.06, marginBottom: 20, color: 'var(--text)', letterSpacing: '-1px' }}>
            {t('landing.hero_title')}<br />
            <span style={{ color: 'var(--accent)' }}>{t('landing.hero_highlight')}</span>
          </motion.h1>

          <motion.p variants={fadeUp}
            style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.75, marginBottom: 36 }}>
            {t('landing.hero_sub')}
          </motion.p>

          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            {user ? (
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to="/dashboard" style={primaryBtn}>
                  <LayoutDashboard size={15} /> {t('landing.go_dashboard')}
                </Link>
              </motion.div>
            ) : (
              <>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/register" style={primaryBtn}>
                    {t('landing.get_started_free')} <ArrowRight size={15} />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/login" style={ghostBtn}>{t('landing.sign_in')}</Link>
                </motion.div>
              </>
            )}
          </motion.div>

          {!user && (
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[t('landing.trust_free'), t('landing.trust_no_card'), t('landing.trust_roles')].map(txt => (
                <span key={txt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                  <CheckCircle size={13} color="var(--success)" /> {txt}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        {/* Mockup */}
        <motion.div variants={fadeUp} className="hero-mockup"
          style={{ perspective: 1000 }}>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
            <DashboardMockup />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── STATS BAR ────────────────────────────────────────────────── */}
      {platformStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 88 }}
          className="stats-grid">
          {[
            { label: t('landing.stat_teachers'), value: platformStats.total_teachers, icon: <GraduationCap size={18} color="var(--accent)" /> },
            { label: t('landing.stat_students'), value: platformStats.total_students, icon: <Users size={18} color="#6366F1" /> },
            { label: t('landing.stat_lessons'),  value: platformStats.total_lessons,  icon: <ClipboardList size={18} color="#F59E0B" /> },
            { label: t('landing.stat_groups'),   value: platformStats.total_groups,   icon: <LayoutDashboard size={18} color="#22C55E" /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{s.icon}</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                <Counter value={s.value} />
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ marginBottom: 88 }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>How it works</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, marginTop: 10, marginBottom: 12, letterSpacing: '-0.5px' }}>
            {t('landing.how_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>{t('landing.how_sub')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, position: 'relative' }} className="steps-grid">
          {/* connector line */}
          <div className="steps-line" style={{ position: 'absolute', top: 28, left: 'calc(16% + 20px)', right: 'calc(16% + 20px)', height: 2, background: 'linear-gradient(90deg, var(--accent), #6366F1, #F59E0B)', opacity: 0.25, borderRadius: 2 }} />

          {steps.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.icon}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{s.n}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── GAME FEATURE CALLOUT ──────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 88, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(28px, 5vw, 52px)', overflow: 'hidden', position: 'relative' }}
        className="game-grid">

        {/* Background glow */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, background: 'var(--accent)', opacity: 0.05, borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

        {/* Jeopardy board mockup */}
        <div style={{ order: 0 }} className="game-board-side">
          <div style={{ background: 'var(--bg)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2, paddingBottom: 0 }}>
              {['Python', 'Django', 'React'].map(t => (
                <div key={t} style={{ background: 'var(--accent)', padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#fff', borderRadius: '6px 6px 0 0', letterSpacing: '.04em' }}>{t}</div>
              ))}
            </div>
            {/* Cells */}
            {[[1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]].map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '0 2px', marginTop: 2 }}>
                {row.map((answered, ci) => {
                  const pts = (ri + 1) * 100
                  const colors = ['#22C55E', '#F59E0B', '#EF4444']
                  return (
                    <div key={ci} style={{ background: answered ? 'var(--surface)' : colors[ci % 3], borderRadius: 6, padding: '10px 4px', textAlign: 'center', opacity: answered ? 0.25 : 1, transition: 'opacity 0.2s' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#fff' }}>{pts}</span>
                    </div>
                  )
                })}
              </div>
            ))}
            {/* Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 8, marginTop: 4 }}>
              {[['🦁 Lions', 400], ['🐍 Pythons', 250]].map(([name, score]) => (
                <div key={name} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
            <Gamepad2 size={13} color="#6366F1" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6366F1' }}>Quiz Games</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px' }}>
            {t('landing.game_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 28 }}>{t('landing.game_sub')}</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {gamePoints.map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <Zap size={14} color="var(--accent)" style={{ flexShrink: 0 }} /> {p}
              </li>
            ))}
          </ul>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link to={user ? '/groups' : '/register'} style={primaryBtn}>
              <Trophy size={15} /> {t('landing.game_btn')} <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* ── FEATURES GRID ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ marginBottom: 88 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Features</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginTop: 10, letterSpacing: '-0.5px' }}>
            {t('landing.features_title')}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 20px', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <f.icon size={19} color="var(--accent)" />
              </div>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ maxWidth: 700, margin: '0 auto 88px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>FAQ</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, marginTop: 10, letterSpacing: '-0.5px' }}>
            {t('landing.faq_title')}
          </h2>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '0 28px' }}>
          {faqs.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
        </div>
      </motion.div>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, var(--accent) 50%, #6366F1 100%)', borderRadius: 20, padding: 'clamp(40px, 6vw, 64px)', textAlign: 'center', marginBottom: 56, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.5px', position: 'relative' }}>
          {t('landing.cta_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 32, position: 'relative' }}>{t('landing.cta_sub')}</p>
        <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block', position: 'relative' }}>
          <Link to={user ? '/dashboard' : '/register'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 32px', borderRadius: 12, background: '#fff', color: '#0f766e', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            {user
              ? <><LayoutDashboard size={16} /> {t('landing.go_dashboard')}</>
              : <>{t('landing.cta_btn')} <ArrowRight size={16} /></>}
          </Link>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
        .hero-grid {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr; }
          .hero-mockup { display: none; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .steps-line { display: none; }
          .game-grid { grid-template-columns: 1fr !important; }
          .game-board-side { order: -1; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '12px 26px', borderRadius: 10,
  background: 'var(--accent)', color: '#fff',
  fontSize: 14, fontWeight: 700, textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
}
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '12px 26px', borderRadius: 10,
  border: '1.5px solid var(--border)', color: 'var(--text)',
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
}
