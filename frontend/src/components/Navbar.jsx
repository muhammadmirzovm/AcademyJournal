import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Sun, Moon, Menu, X, GraduationCap, LogOut, User, LayoutDashboard, Users, Globe, BookMarked, Settings, ClipboardList } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'

const LANGS = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'uz', label: 'UZ', full: "O'zbek" },
  { code: 'ru', label: 'RU', full: 'Русский' },
]

export default function Navbar() {
  const { user, logout }    = useAuth()
  const { theme, toggle }   = useTheme()
  const { t, i18n }         = useTranslation()
  const navigate             = useNavigate()
  const location             = useLocation()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [langOpen,   setLangOpen]   = useState(false)
  const [scrolled,   setScrolled]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // close drawer on route change
  useEffect(() => { setDrawerOpen(false); setLangOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }
  const setLang = (code) => { i18n.changeLanguage(code); setLangOpen(false) }
  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0]

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const navLinks = user ? [
    { to: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={15} /> },
    ...(user.role === 'admin' || user.role === 'teacher'
      ? [{ to: '/groups', label: t('nav.groups'), icon: <Users size={15} /> }]
      : []),
    ...(user.role === 'student'
      ? [{ to: '/exams', label: t('nav.exams'), icon: <ClipboardList size={15} /> }]
      : []),
    ...(user.role === 'admin' || user.role === 'teacher'
      ? [{ to: '/settings', label: t('nav.settings'), icon: <Settings size={15} /> }]
      : []),
  ] : []

  const initials = user
    ? (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()
    : ''

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: scrolled
          ? 'rgba(var(--nav-bg-rgb, 15,17,27), 0.88)'
          : 'var(--nav-bg)',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.25s, border-color 0.25s, backdrop-filter 0.25s',
        height: 60,
      }}>
        <div className="nav-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0, marginRight: 8 }}>
            <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(16,185,129,0.35)' }}>
              <GraduationCap size={17} color="#fff" />
            </div>
            <span className="nav-brand-text" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px' }}>
              <span style={{ color: '#fff' }}>Academy </span>
              <span style={{ color: '#14B8A8' }}>Journal</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {navLinks.map(link => (
              <Link key={link.to} to={link.to}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                  color: isActive(link.to) ? 'var(--accent)' : '#94A3B8',
                  background: isActive(link.to) ? 'rgba(16,185,129,0.1)' : 'transparent',
                }}>
                {link.icon} {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop right controls */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Notifications */}
            {user && <NotificationBell />}

            {/* Theme toggle */}
            <button onClick={toggle} style={circleBtn} title="Toggle theme">
              {theme === 'dark'
                ? <Sun size={15} color="#94A3B8" />
                : <Moon size={15} color="#94A3B8" />}
            </button>

            {/* Lang switcher */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setLangOpen(o => !o)}
                style={{ ...circleBtn, width: 'auto', padding: '0 12px', borderRadius: 8, gap: 5, fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>
                <Globe size={13} color="#94A3B8" />
                {currentLang.label}
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{ position: 'absolute', right: 0, top: 46, background: 'var(--nav-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', minWidth: 130, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 300 }}>
                    {LANGS.map(l => (
                      <button key={l.code} onClick={() => setLang(l.code)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: i18n.language === l.code ? 'rgba(16,185,129,0.12)' : 'transparent', border: 'none', cursor: 'pointer', color: i18n.language === l.code ? 'var(--accent)' : '#94A3B8', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                        <span>{l.full}</span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>{l.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user ? (
              <>
                {/* Avatar → profile */}
                <Link to={`/profile/${user.id}`}
                  style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #059669)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', textDecoration: 'none', flexShrink: 0, boxShadow: '0 0 0 2px rgba(16,185,129,0.3)' }}
                  title={t('nav.profile')}>
                  {initials}
                </Link>
                <button onClick={handleLogout} style={circleBtn} title={t('nav.logout')}>
                  <LogOut size={15} color="#94A3B8" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94A3B8' }}>
                  {t('nav.login')}
                </Link>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 10px rgba(16,185,129,0.3)', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(16,185,129,0.45)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(16,185,129,0.3)'}>
                  {t('nav.get_started')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right: theme + hamburger */}
          <div className="mobile-nav" style={{ display: 'none', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button onClick={toggle} style={circleBtn}>
              {theme === 'dark' ? <Sun size={15} color="#94A3B8" /> : <Moon size={15} color="#94A3B8" />}
            </button>
            <button onClick={() => setDrawerOpen(o => !o)} style={{ ...circleBtn, borderColor: drawerOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
              {drawerOpen ? <X size={17} color="#fff" /> : <Menu size={17} color="#94A3B8" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile backdrop + drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.5)', zIndex: 190, backdropFilter: 'blur(3px)' }} />

            {/* Drawer */}
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 270, background: 'var(--nav-bg)', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 195, overflowY: 'auto' }}>

              {/* User info strip */}
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{user.first_name || user.username}</p>
                    <p style={{ fontSize: 11, color: '#64748B', textTransform: 'capitalize' }}>{user.role}</p>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {user && (
                <div style={{ padding: '8px 4px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <NotificationBell />
                </div>
              )}

              {/* Nav links */}
              {navLinks.map(link => (
                <DrawerLink key={link.to} to={link.to} icon={link.icon} active={isActive(link.to)}>
                  {link.label}
                </DrawerLink>
              ))}

              {user && (
                <DrawerLink to={`/profile/${user.id}`} icon={<User size={16} />} active={isActive(`/profile/${user.id}`)}>
                  {t('nav.profile')}
                </DrawerLink>
              )}

              {/* Language section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 12px', marginBottom: 6 }}>{t('nav.language')}</p>
                <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
                  {LANGS.map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${i18n.language === l.code ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`, background: i18n.language === l.code ? 'rgba(16,185,129,0.12)' : 'transparent', color: i18n.language === l.code ? 'var(--accent)' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth actions */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 14 }}>
                {user ? (
                  <button onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#F87171', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 9 }}>
                    <LogOut size={15} /> {t('nav.logout')}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link to="/login" onClick={() => setDrawerOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                      {t('nav.login')}
                    </Link>
                    <Link to="/register" onClick={() => setDrawerOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                      {t('nav.get_started')}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 720px) {
          .desktop-nav { display: none !important; }
          .mobile-nav  { display: flex !important; }
          .nav-inner   { padding: 0 16px !important; }
        }
        @media (max-width: 400px) {
          .nav-brand-text { display: none !important; }
          .nav-inner      { padding: 0 12px !important; }
        }
      `}</style>
    </>
  )
}

function DrawerLink({ to, icon, active, children }) {
  return (
    <Link to={to}
      style={{ display: 'flex', alignItems: 'center', gap: 10, color: active ? 'var(--accent)' : '#CBD5E1', fontSize: 14, fontWeight: active ? 700 : 500, textDecoration: 'none', padding: '10px 12px', borderRadius: 9, background: active ? 'rgba(16,185,129,0.1)' : 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ color: active ? 'var(--accent)' : '#64748B' }}>{icon}</span>
      {children}
    </Link>
  )
}

const circleBtn = {
  width: 36, height: 36, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'border-color 0.15s, background 0.15s',
}
