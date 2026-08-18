import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ScanLine, Search, Loader2, CheckCircle2, Clock, User, Coins, Undo2 } from 'lucide-react'
import { lookupPurchase, issuePurchase, undoIssuePurchase } from '../api/purchases'
import { formatDate } from '../utils/date'
import { useToast } from '../context/ToastContext'

// Mirrors backend UNDO_ISSUE_WINDOW_MINUTES — display-only; the server is
// the actual authority and will reject an undo past its own window.
const UNDO_WINDOW_MINUTES = 10

export default function PurchaseScanner() {
  const { t }    = useTranslation()
  const { show } = useToast()
  const inputRef = useRef(null)

  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [issuing, setIssuing]   = useState(false)
  const [undoing, setUndoing]   = useState(false)
  const [purchase, setPurchase] = useState(null)
  const [error, setError]       = useState('')

  const reset = () => {
    setCode('')
    setPurchase(null)
    setError('')
    inputRef.current?.focus()
  }

  const submit = async e => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setPurchase(null)
    try {
      const { data } = await lookupPurchase(code.trim())
      setPurchase(data)
    } catch (err) {
      setError(err.response?.status === 404 ? t('scanner.not_found') : t('scanner.lookup_fail'))
    } finally { setLoading(false) }
  }

  const handleIssue = async () => {
    setIssuing(true)
    try {
      const { data } = await issuePurchase(purchase.id)
      setPurchase(data)
      show(t('scanner.toast_issued'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('scanner.toast_issue_fail'), 'error')
    } finally { setIssuing(false) }
  }

  const handleUndo = async () => {
    setUndoing(true)
    try {
      const { data } = await undoIssuePurchase(purchase.id)
      setPurchase(data)
      show(t('scanner.toast_undone'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('scanner.toast_undo_fail'), 'error')
    } finally { setUndoing(false) }
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, background: 'var(--accent-bg)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <ScanLine size={26} color="var(--accent)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('scanner.title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('scanner.subtitle')}</p>
      </div>

      <form onSubmit={submit} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder={t('scanner.code_placeholder')}
            maxLength={6}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            style={{
              flex: 1, minWidth: 0, padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 22, fontWeight: 800,
              letterSpacing: '0.2em', textAlign: 'center', textTransform: 'uppercase',
              fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <motion.button type="submit" whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }}
            disabled={loading || !code.trim()} style={{ ...primaryBtn, opacity: (loading || !code.trim()) ? 0.6 : 1, paddingLeft: 18, paddingRight: 18 }}>
            {loading ? <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Search size={18} />}
          </motion.button>
        </div>
      </form>

      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', padding: '16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          {error}
        </motion.div>
      )}

      {purchase && (
        <PurchaseCard purchase={purchase} issuing={issuing} undoing={undoing}
          onIssue={handleIssue} onUndo={handleUndo} onReset={reset} t={t} />
      )}
    </div>
  )
}

const STATUS_META = {
  active:  { color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  issued:  { color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
  expired: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

function PurchaseCard({ purchase, issuing, undoing, onIssue, onUndo, onReset, t }) {
  const meta = STATUS_META[purchase.status] || STATUS_META.active
  const canIssue = purchase.status === 'active' && !purchase.is_expired
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    const recompute = () => {
      setCanUndo(
        purchase.status === 'issued' && !!purchase.issued_at &&
        (Date.now() - new Date(purchase.issued_at).getTime()) < UNDO_WINDOW_MINUTES * 60 * 1000
      )
    }
    recompute()
    const interval = setInterval(recompute, 15000)
    return () => clearInterval(interval)
  }, [purchase])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'var(--surface)', border: `1.5px solid ${meta.color}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
      {purchase.reward_image ? (
        <img src={purchase.reward_image} alt={purchase.reward_name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, margin: '0 auto 10px' }} />
      ) : (
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>{purchase.reward_icon || '🎁'}</div>
      )}
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{purchase.reward_name}</p>
      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
        {purchase.quantity} × {purchase.price_at_order} = {purchase.total_price} <Coins size={13} color="var(--text-muted)" />
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, marginBottom: 14 }}>
        <User size={15} color="var(--text-muted)" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{purchase.student_name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{purchase.student_username}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, color: meta.color, background: meta.bg }}>
          {t(`scanner.status_${purchase.status}`)}
        </span>
        {purchase.status === 'active' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: purchase.is_expired ? 'var(--danger)' : 'var(--text-muted)' }}>
            <Clock size={12} /> {formatDate(purchase.expires_at)}
          </span>
        )}
      </div>

      {canIssue ? (
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={onIssue} disabled={issuing}
          style={{ ...primaryBtn, width: '100%', justifyContent: 'center', opacity: issuing ? 0.7 : 1 }}>
          {issuing ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle2 size={16} />}
          {issuing ? t('scanner.issuing') : t('scanner.issue_btn')}
        </motion.button>
      ) : canUndo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={onUndo} disabled={undoing}
            style={{ ...ghostBtn, width: '100%', justifyContent: 'center', color: 'var(--danger)', borderColor: 'var(--danger)', opacity: undoing ? 0.7 : 1 }}>
            {undoing ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Undo2 size={16} />}
            {undoing ? t('scanner.undoing') : t('scanner.undo_btn')}
          </motion.button>
          <button onClick={onReset} style={{ ...ghostBtn, width: '100%', justifyContent: 'center' }}>{t('scanner.scan_another')}</button>
        </div>
      ) : (
        <button onClick={onReset} style={{ ...ghostBtn, width: '100%', justifyContent: 'center' }}>{t('scanner.scan_another')}</button>
      )}
    </motion.div>
  )
}

const primaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const ghostBtn   = { display: 'inline-flex', alignItems: 'center', padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
