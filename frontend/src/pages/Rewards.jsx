import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Gift, Plus, Loader2, Star, Pencil, Trash2 } from 'lucide-react'
import { getRewards, createReward, updateReward, deleteReward } from '../api/rewards'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { CardSkeleton } from '../components/ui/Skeleton'

const CATEGORIES = ['snack', 'stationery', 'merch', 'discount', 'other']

const BADGE_COLORS = {
  'badge-soon':    '#F59E0B',
  'badge-soldout': '#DC2626',
  'badge-low':     '#0EA5E9',
}

export default function Rewards() {
  const { user } = useAuth()
  const { show }  = useToast()
  const { t }     = useTranslation()
  const isAdmin   = user?.role === 'admin'

  const [rewards, setRewards]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [editingReward, setEditingReward] = useState(null)
  const [category, setCategory]           = useState('all')

  const load = () => {
    setLoading(true)
    getRewards().then(r => setRewards(r.data)).catch(() => show(t('rewards.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const counts = useMemo(() => {
    const c = { all: rewards.length }
    CATEGORIES.forEach(cat => { c[cat] = rewards.filter(r => r.category === cat).length })
    return c
  }, [rewards])

  const visible = useMemo(
    () => category === 'all' ? rewards : rewards.filter(r => r.category === category),
    [rewards, category]
  )

  const handleSaved = (saved, wasEdit) => {
    if (wasEdit) {
      setRewards(rs => rs.map(r => r.id === saved.id ? saved : r))
      show(t('rewards.toast_updated'), 'success')
    } else {
      setRewards(rs => [saved, ...rs])
      show(t('rewards.toast_created'), 'success')
    }
    setShowCreate(false)
    setEditingReward(null)
  }

  const handleDelete = async (id) => {
    try {
      await deleteReward(id)
      setRewards(rs => rs.filter(r => r.id !== id))
      show(t('rewards.toast_deleted'), 'success')
    } catch {
      show(t('rewards.toast_delete_fail'), 'error')
    }
  }

  return (
    <div>
      <div className="page-section-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('rewards.title')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('rewards.subtitle')}</p>
        </div>
        {isAdmin && (
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)} style={primaryBtn}>
            <Plus size={15} /> {t('rewards.add_button')}
          </motion.button>
        )}
      </div>

      {!loading && rewards.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[{ key: 'all', label: t('rewards.cat_all') }, ...CATEGORIES.map(cat => ({ key: cat, label: t(`rewards.cat_${cat}`) }))].map(tab => {
            const on = category === tab.key
            return (
              <button key={tab.key} onClick={() => setCategory(tab.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {tab.label}
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: 999,
                  background: on ? 'rgba(255,255,255,0.25)' : 'color-mix(in srgb, var(--accent) 14%, transparent)',
                  color: on ? '#fff' : 'var(--accent)' }}>{counts[tab.key] ?? 0}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
          {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasAny={rewards.length > 0} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
          {visible.map((r, i) => (
            <RewardCard key={r.id} reward={r} index={i} isAdmin={isAdmin}
              onEdit={() => setEditingReward(r)} onDelete={() => handleDelete(r.id)} />
          ))}
        </div>
      )}

      <RewardFormModal open={showCreate || !!editingReward} reward={editingReward}
        onClose={() => { setShowCreate(false); setEditingReward(null) }}
        onSaved={handleSaved} />
    </div>
  )
}

function RewardCard({ reward, index, isAdmin, onEdit, onDelete }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const isSoldOut  = reward.status === 'available' && reward.stock <= 0
  const isInactive = reward.status === 'coming_soon' || isSoldOut
  const badgeColor = reward.badge ? BADGE_COLORS[reward.badge.kind] : null

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      whileHover={!isInactive ? { y: -3, boxShadow: 'var(--shadow-lg)' } : {}}
      style={{
        position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 20, textAlign: 'center', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s',
        opacity: isInactive ? 0.55 : 1, filter: isInactive ? 'grayscale(45%)' : 'none',
      }}>
      {reward.badge && (
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: '#fff', background: badgeColor }}>
          {reward.badge.label}
        </span>
      )}
      <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>{reward.icon || '🎁'}</div>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{reward.name}</p>
      {reward.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', minHeight: 30, marginBottom: 10 }}>{reward.description}</p>}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 16, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 8, padding: '4px 12px' }}>
        <Star size={14} color="var(--accent)" fill="var(--accent)" /> {reward.price}
      </span>

      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {confirm ? (
            <>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('rewards.delete_confirm')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('rewards.cancel')}</button>
            </>
          ) : (
            <>
              <button onClick={onEdit} title={t('rewards.edit_reward')} style={iconActionBtn}><Pencil size={13} color="var(--text-muted)" /></button>
              <button onClick={() => setConfirm(true)} title={t('rewards.delete_reward')} style={iconActionBtn}><Trash2 size={13} color="var(--text-muted)" /></button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

function EmptyState({ hasAny }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
      <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Gift size={28} color="var(--accent)" />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('rewards.no_rewards')}</h3>
      {!hasAny && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('rewards.no_rewards_sub')}</p>}
    </motion.div>
  )
}

const emptyForm = { name: '', description: '', icon: '', price: '', stock: 0, category: 'other', status: 'coming_soon' }

function RewardFormModal({ open, reward, onClose, onSaved }) {
  const { show } = useToast(); const { t } = useTranslation()
  const isEdit = !!reward
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(reward
        ? { name: reward.name, description: reward.description || '', icon: reward.icon || '', price: reward.price, stock: reward.stock, category: reward.category, status: reward.status }
        : emptyForm)
      setError('')
    }
  }, [open, reward])

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('rewards.err_name_required')); return }
    if (!form.price || Number(form.price) <= 0) { setError(t('rewards.err_price_required')); return }
    setLoading(true)
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) || 0 }
    try {
      const { data } = isEdit ? await updateReward(reward.id, payload) : await createReward(payload)
      onSaved(data, isEdit)
    } catch {
      show(t(isEdit ? 'rewards.toast_update_fail' : 'rewards.toast_create_fail'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t(isEdit ? 'rewards.edit_modal_title' : 'rewards.create_modal_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.name_label')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.icon_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('rewards.icon_optional')}</span></label>
          <input style={{ ...inputStyle(false), marginTop: 6, maxWidth: 100 }} maxLength={8} placeholder="🎁"
            value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.description_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('rewards.description_optional')}</span></label>
          <textarea style={{ ...inputStyle(false), marginTop: 6, resize: 'vertical', minHeight: 64 }}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.price_label')}</label>
            <input type="number" min={1} style={{ ...inputStyle(!!error), marginTop: 6 }}
              value={form.price} onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setError('') }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.stock_label')}</label>
            <input type="number" min={0} style={{ ...inputStyle(false), marginTop: 6 }}
              value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
          </div>
        </div>
        {error && <p style={errorStyle}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.category_label')}</label>
            <select style={{ ...inputStyle(false), marginTop: 6 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{t(`rewards.cat_${cat}`)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.status_label')}</label>
            <select style={{ ...inputStyle(false), marginTop: 6 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="coming_soon">{t('rewards.status_coming_soon')}</option>
              <option value="available">{t('rewards.status_available')}</option>
              <option value="hidden">{t('rewards.status_hidden')}</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('rewards.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('rewards.creating') : t(isEdit ? 'rewards.save_btn' : 'rewards.create_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

const primaryBtn    = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn       = { padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const dangerBtn       = { padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const iconActionBtn = { width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const errorStyle = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }
const inputStyle = (hasError) => ({ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', display: 'block', boxSizing: 'border-box' })
