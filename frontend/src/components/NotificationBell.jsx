import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, BookOpen, UserX, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getNotifications, markAllRead, markOneRead } from '../api/notifications'

const TYPE_ICON = {
  score:  <Star size={14} color="#F59E0B" fill="#F59E0B" />,
  absent: <UserX size={14} color="#EF4444" />,
  lesson: <BookOpen size={14} color="#14B8A8" />,
}

const TYPE_COLOR = {
  score:  'rgba(245,158,11,0.1)',
  absent: 'rgba(239,68,68,0.1)',
  lesson: 'rgba(20,184,168,0.1)',
}

const TYPE_TEXT_COLOR = {
  score:  '#F59E0B',
  absent: '#EF4444',
  lesson: '#14B8A6',
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)  return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [unread,  setUnread]  = useState(0)
  const ref = useRef(null)

  const fetchNotifs = () => {
    getNotifications().then(r => {
      setNotifs(r.data.results)
      setUnread(r.data.unread)
    }).catch(() => {})
  }

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open && unread > 0) {
      markAllRead().then(() => {
        setUnread(0)
        setNotifs(ns => ns.map(n => ({ ...n, is_read: true })))
      }).catch(() => {})
    }
  }

  const handleOne = (id) => {
    markOneRead(id).catch(() => {})
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(u => Math.max(0, u - 1))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{
        position: 'relative', width: 36, height: 36, borderRadius: 8,
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bell size={16} color="#94A3B8" />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 800, lineHeight: 1,
            padding: '2px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', right: 0, top: 46, width: 320,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)', zIndex: 300,
            }}
          >
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{t('notif.title')}</p>
              {notifs.some(n => !n.is_read) && (
                <button onClick={() => { markAllRead(); setUnread(0); setNotifs(ns => ns.map(n => ({ ...n, is_read: true }))) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={11} /> {t('notif.mark_all')}
                </button>
              )}
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.length === 0 ? (
                <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('notif.empty')}
                </p>
              ) : (
                notifs.map(n => (
                  <div key={n.id} onClick={() => !n.is_read && handleOne(n.id)}
                    style={{
                      display: 'flex', gap: 10, padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: n.is_read ? 'transparent' : 'var(--accent-bg)',
                      cursor: n.is_read ? 'default' : 'pointer',
                    }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: TYPE_COLOR[n.type] || 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      {TYPE_ICON[n.type]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: n.is_read ? 'var(--text-muted)' : (TYPE_TEXT_COLOR[n.type] || 'var(--text)'), marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{n.body}</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
