import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStudentCoins, manageStudentCoins } from '../api/coins'
import { useToast } from '../context/toast'

export default function StudentCoinManager({ studentId, onChanged }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [wallet, setWallet] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [action, setAction] = useState('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (p) => {
    setLoading(true)
    setFailed(false)
    try {
      const { data } = await getStudentCoins(studentId, p)
      setWallet(data)
      setPage(p)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [studentId])
  useEffect(() => {
    let active = true
    getStudentCoins(studentId, 1)
      .then(({ data }) => { if (active) setWallet(data) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [studentId])

  const preview = e => {
    e.preventDefault()
    const value = Number(amount)
    if (action !== 'reset' && (!Number.isInteger(value) || value < 1 || value > 2147483647)) return
    const delta = action === 'reset' ? -wallet.balance : action === 'add' ? value : -value
    if (wallet.balance + delta < 0 && action === 'subtract') { show(t('student_coins.insufficient'), 'error'); return }
    setReview({ action, amount: action === 'reset' ? undefined : value, reason: reason.trim(), expected_balance: wallet.balance, delta })
  }
  const submit = async () => {
    if (saving || !review) return
    setSaving(true)
    try {
      const payload = { action: review.action, amount: review.amount, reason: review.reason, expected_balance: review.expected_balance }
      await manageStudentCoins(studentId, payload)
      setReview(null)
      setAmount('')
      setReason('')
      show(t('student_coins.success'), 'success')
      onChanged?.()
      await load(1)
    } catch (error) {
      setReview(null)
      show(t(error.response?.status === 409 ? 'student_coins.changed' : 'student_coins.error'), 'error')
      await load(page)
    } finally { setSaving(false) }
  }
  return (
    <section className="student-coin-manager" aria-label={t('student_coins.title')} style={{ gridColumn: '1 / -1', padding: 20, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', minWidth: 0 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>{t('student_coins.title')}</h2>
      <p>{t('student_coins.balance')}: <strong>{wallet?.balance ?? '—'}</strong></p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('student_coins.hint')}</p>
      {failed ? <div role="alert">{t('student_coins.load_error')} <button type="button" onClick={() => load(page)}>{t('student_coins.retry')}</button></div> : loading ? <p role="status">{t('student_coins.loading')}</p> : wallet && (
        <>
          <form onSubmit={preview} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '20px 0' }}>
            <fieldset disabled={saving || !!review} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 12, width: '100%', minWidth: 0 }}>
              <label>{t('student_coins.action')}<select value={action} onChange={e => setAction(e.target.value)}>
                {['add', 'subtract', 'reset'].map(key => <option key={key} value={key}>{t(`student_coins.${key}`)}</option>)}
              </select></label>
              {action !== 'reset' && <label>{t('student_coins.amount')}<input type="number" min="1" max="2147483647" step="1" required value={amount} onChange={e => setAmount(e.target.value)} /></label>}
              <label style={{ flex: '1 1 220px' }}>{t('student_coins.reason')}<input required maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></label>
              <button type="submit" disabled={!reason.trim() || (action === 'reset' && wallet.balance === 0)}>{t('student_coins.review')}</button>
            </fieldset>
          </form>
          {review && <div role="group" aria-label={t('student_coins.confirm_title')} style={{ padding: 16, border: '1px solid var(--accent)', borderRadius: 10, marginBottom: 20 }}>
            <strong>{t('student_coins.confirm_title')}</strong>
            <p>{review.expected_balance} → <strong>{review.expected_balance + review.delta}</strong> ({review.delta > 0 ? '+' : ''}{review.delta})</p>
            <p style={{ overflowWrap: 'anywhere' }}>{review.reason}</p>
            <button type="button" disabled={saving} onClick={submit}>{t(saving ? 'student_coins.saving' : 'student_coins.confirm')}</button>{' '}
            <button type="button" disabled={saving} onClick={() => setReview(null)}>{t('student_coins.cancel')}</button>
          </div>}
          <h3 style={{ fontSize: 15 }}>{t('student_coins.history')}</h3>
          {!wallet.results.length && <p>{t('student_coins.empty')}</p>}
          <div style={{ display: 'grid', gap: 8 }}>
            {wallet.results.map(entry => <article key={entry.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><strong style={{ color: entry.amount > 0 ? 'var(--success)' : 'var(--text)' }}>{entry.amount > 0 ? '+' : ''}{entry.amount}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
              <p style={{ margin: '6px 0', overflowWrap: 'anywhere' }}>{entry.reason}</p>
              <small style={{ color: 'var(--text-muted)' }}>{t(`student_coins.types.${entry.type}`, { defaultValue: entry.type })} · {entry.created_by_name || t('student_coins.system')}</small>
            </article>)}
          </div>
          {wallet.count > 20 && <nav aria-label={t('student_coins.history')} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button disabled={saving || page === 1} onClick={() => load(page - 1)}>{t('student_coins.previous')}</button>
            <span>{page} / {Math.ceil(wallet.count / 20)}</span>
            <button disabled={saving || page * 20 >= wallet.count} onClick={() => load(page + 1)}>{t('student_coins.next')}</button>
          </nav>}
        </>
      )}
      <style>{`.student-coin-manager label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; max-width: 100%; min-width: 0; }
        .student-coin-manager input, .student-coin-manager select, .student-coin-manager button { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); color: var(--text); background: var(--card); min-width: 0; max-width: 100%; box-sizing: border-box; }
        .student-coin-manager button { cursor: pointer; align-self: end; }
        .student-coin-manager button:disabled { opacity: .5; cursor: default; }
        @media (max-width: 480px) { .student-coin-manager label { flex: 1 1 100%; } }`}</style>
    </section>
  )
}
