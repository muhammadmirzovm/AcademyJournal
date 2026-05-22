import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Megaphone, Pin, Trash2, Loader2, Plus, X } from 'lucide-react'

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function AnnouncementCard({ ann, canDelete, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const { t } = useTranslation()

  const handleDelete = async () => {
    setDeleting(true)
    try { await onDelete(ann.id) }
    finally { setDeleting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px',
        background: ann.is_pinned ? 'var(--accent-bg)' : 'var(--surface)',
        border: `1px solid ${ann.is_pinned ? 'rgba(20,184,168,0.35)' : 'var(--border)'}`,
        borderRadius: 12, marginBottom: 10,
      }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ann.is_pinned ? 'rgba(20,184,168,0.15)' : 'rgba(99,102,241,0.1)' }}>
        {ann.is_pinned
          ? <Pin size={16} color="var(--accent)" />
          : <Megaphone size={16} color="#6366F1" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: ann.body ? 4 : 0 }}>
          {ann.title}
        </p>
        {ann.body && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 6 }}>
            {ann.body}
          </p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {ann.author_name} · {timeAgo(ann.created_at)}
        </p>
      </div>

      {canDelete && (
        <button onClick={handleDelete} disabled={deleting}
          style={{ background: 'none', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0, opacity: deleting ? 0.5 : 1, display: 'flex' }}>
          {deleting
            ? <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
            : <Trash2 size={15} />}
        </button>
      )}
    </motion.div>
  )
}

export function NewAnnouncementForm({ onSubmit, onCancel }) {
  const { t } = useTranslation()
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [pinned,   setPinned]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try { await onSubmit({ title: title.trim(), body: body.trim(), is_pinned: pinned }) }
    finally { setSaving(false) }
  }

  return (
    <motion.form initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
      <input
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder={t('ann.title_placeholder')} maxLength={200} autoFocus
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
      />
      <textarea
        value={body} onChange={e => setBody(e.target.value)}
        placeholder={t('ann.body_placeholder')} rows={3}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
          <Pin size={13} color="var(--accent)" />
          {t('ann.pin')}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            <X size={13} /> {t('ann.cancel')}
          </button>
          <button type="submit" disabled={saving || !title.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving || !title.trim() ? 'not-allowed' : 'pointer', opacity: saving || !title.trim() ? 0.65 : 1 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Megaphone size={13} />}
            {saving ? t('ann.posting') : t('ann.post')}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.form>
  )
}

export function AnnouncementsSection({ announcements, loading, canPost, onPost, onDelete }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const handlePost = async data => {
    await onPost(data)
    setShowForm(false)
  }

  if (loading) return null
  if (!announcements.length && !canPost) return null

  return (
    <div style={{ marginBottom: 24 }}>
      {showForm && (
        <NewAnnouncementForm onSubmit={handlePost} onCancel={() => setShowForm(false)} />
      )}
      {announcements.map(ann => (
        <AnnouncementCard key={ann.id} ann={ann}
          canDelete={canPost}
          onDelete={onDelete} />
      ))}
      {canPost && !showForm && (
        <button onClick={() => setShowForm(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('ann.new')}
        </button>
      )}
    </div>
  )
}
