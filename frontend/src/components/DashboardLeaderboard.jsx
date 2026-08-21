import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Coins, Trophy, AlertTriangle } from 'lucide-react'
import { getCoinLeaderboard } from '../api/coins'
import { getTeacherLeaderboard } from '../api/users'
import { useAuth } from '../context/AuthContext'

const COIN_MEDALS = [
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', height: 78 },
  { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', height: 58 },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', height: 48 },
]
const SCORE_MEDALS = [
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', height: 80 },
  { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', height: 60 },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', height: 50 },
]
const MEDAL_EMOJI = ['🥇', '🥈', '🥉']
const LB_PAGE_SIZE = 20

export default function DashboardLeaderboard() {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'

  const [tab, setTab] = useState('coins')

  const [coinRows, setCoinRows]       = useState([])
  const [coinLoading, setCoinLoading] = useState(true)
  const [scoreRows, setScoreRows]       = useState([])
  const [scoreLoading, setScoreLoading] = useState(isTeacher)
  const [scorePage, setScorePage]       = useState(1)

  useEffect(() => {
    getCoinLeaderboard().then(r => setCoinRows(r.data)).catch(() => {}).finally(() => setCoinLoading(false))
  }, [])

  // If the academy hasn't earned any coins yet but this teacher's students
  // do have score/attendance data, don't default onto an empty coins tab.
  useEffect(() => {
    if (!coinLoading && !scoreLoading && isTeacher && coinRows.length === 0 && scoreRows.length > 0) {
      setTab('score')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinLoading, scoreLoading])

  useEffect(() => {
    if (!isTeacher) return
    getTeacherLeaderboard().then(r => setScoreRows(r.data)).catch(() => {}).finally(() => setScoreLoading(false))
  }, [isTeacher])

  const loading = tab === 'coins' ? coinLoading : scoreLoading
  const hasCoinData  = coinRows.length > 0
  const hasScoreData = scoreRows.length >= 3
  const bothDone = !coinLoading && (!isTeacher || !scoreLoading)
  if (bothDone && !hasCoinData && !(isTeacher && scoreRows.length > 0)) return null

  return (
    <div className="fade-up-2" style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 20, marginBottom: 32, boxShadow: 'var(--shadow-sm)',
    }}>
      <div className="lb-tabs-hd" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: tab === 'coins' ? 'rgba(245,158,11,0.12)' : 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {tab === 'coins' ? <Coins size={16} color="#F59E0B" /> : <Trophy size={16} color="var(--accent)" />}
          </div>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>
            {tab === 'coins' ? t('dashboard.coin_leaderboard') : t('dashboard.leaderboard')}
          </h3>
        </div>

        {isTeacher && (
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, flexShrink: 0 }}>
            {[
              { key: 'coins', label: t('dashboard.tab_coins'), icon: Coins },
              { key: 'score', label: t('dashboard.tab_score'), icon: Trophy },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: tab === key ? 'var(--surface)' : 'transparent',
                  color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: tab === key ? 'var(--shadow-sm)' : 'none',
                }}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'coins' && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, marginLeft: 38 }}>{t('dashboard.coin_leaderboard_sub')}</p>
      )}

      {loading ? (
        <div style={{ height: 140 }} />
      ) : tab === 'coins' ? (
        hasCoinData ? <CoinTab rows={coinRows} userId={user?.id} t={t} /> : <EmptyNote text={t('dashboard.no_leaderboard_data')} />
      ) : (
        hasScoreData
          ? <ScoreTab rows={scoreRows} page={scorePage} setPage={setScorePage} t={t} />
          : <EmptyNote text={t('dashboard.no_leaderboard_data')} />
      )}

      <style>{`
        @media (max-width: 480px) {
          .lb-tabs-hd { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  )
}

function EmptyNote({ text }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>{text}</p>
}

// ── Coins tab (academy-wide, ranked by lifetime earned) ────────────────────

function CoinTab({ rows, userId, t }) {
  const top  = rows.slice(0, 3)
  const rest = rows.slice(3, 10)
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top
  const medalFor = s => top.indexOf(s)

  return (
    <>
      {top.length === 3 && (
        <div className="podium-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          {order.map((s, i) => {
            const rank  = medalFor(s)
            const medal = COIN_MEDALS[rank]
            const isMe  = userId && s.id === userId
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, maxWidth: 140 }}>
                <Link to={`/profile/${s.id}`} style={{ textDecoration: 'none', textAlign: 'center' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: medal.bg,
                    border: `2px solid ${medal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 4px', fontSize: 20,
                    boxShadow: isMe ? '0 0 0 3px var(--accent-bg), 0 0 0 4.5px var(--accent)' : 'none',
                  }}>
                    {MEDAL_EMOJI[rank]}
                  </div>
                  <p className="podium-name" style={{ fontWeight: 700, fontSize: 13, color: isMe ? 'var(--accent)' : 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                    {s.display_name}
                  </p>
                  {isMe && (
                    <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 99, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 3 }}>
                      {t('dashboard.you_badge')}
                    </span>
                  )}
                  <p style={{ fontSize: 12, color: medal.color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <Coins size={11} /> {s.earned}
                  </p>
                </Link>
                <div style={{ width: '100%', background: medal.bg, border: `1px solid ${medal.color}40`, borderRadius: '8px 8px 0 0', height: medal.height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: medal.color }}>{rank + 1}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {rest.map((s, i) => {
            const rank = i + 3
            const isMe = userId && s.id === userId
            return (
              <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', margin: '0 -8px', borderRadius: 9,
                  background: isMe ? 'var(--accent-bg)' : 'transparent',
                  border: isMe ? '1px solid var(--accent)' : '1px solid transparent',
                  borderBottom: isMe ? '1px solid var(--accent)' : (rank < rows.length - 1 ? '1px solid var(--border)' : '1px solid transparent'),
                }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: isMe ? 'var(--accent)' : 'var(--bg)', border: '1px solid var(--border)', color: isMe ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {rank + 1}
                </span>
                <Link to={`/profile/${s.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: isMe ? 'var(--accent)' : 'var(--text)', textDecoration: 'none' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</span>
                  {isMe && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 99, padding: '1px 7px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t('dashboard.you_badge')}
                    </span>
                  )}
                </Link>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Coins size={12} /> {s.earned}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Score/attendance tab (teacher's own students only) ──────────────────────

function ScoreTab({ rows, page, setPage, t }) {
  const top = rows.slice(0, 3)
  const order = [top[1], top[0], top[2]]
  const heights = [SCORE_MEDALS[1], SCORE_MEDALS[0], SCORE_MEDALS[2]]

  const pageCount    = Math.ceil(rows.length / LB_PAGE_SIZE)
  const safePage     = Math.min(page, pageCount)
  const visible      = rows.slice((safePage - 1) * LB_PAGE_SIZE, safePage * LB_PAGE_SIZE)
  const globalOffset = (safePage - 1) * LB_PAGE_SIZE
  const atRisk       = rows.filter(s => s.avg_score != null && s.avg_score < 80)

  return (
    <>
      <div className="podium-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
        {order.map((s, i) => {
          const medal = heights[i]
          const rank  = i === 1 ? 0 : i === 0 ? 1 : 2
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, maxWidth: 140 }}>
              <Link to={`/profile/${s.id}`} style={{ textDecoration: 'none', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: medal.bg, border: `2px solid ${medal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontSize: 20 }}>
                  {MEDAL_EMOJI[rank]}
                </div>
                <p className="podium-name" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{s.display_name}</p>
                <p style={{ fontSize: 12, color: medal.color, fontWeight: 800 }}>{s.avg_score ?? '—'}%</p>
              </Link>
              <div style={{ width: '100%', background: medal.bg, border: `1px solid ${medal.color}40`, borderRadius: '8px 8px 0 0', height: medal.height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: medal.color }}>{rank + 1}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', marginBottom: pageCount > 1 ? 0 : 24 }}>
        {visible.map((s, i) => {
          const gi = globalOffset + i
          return (
            <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: gi < 3 ? ['rgba(245,158,11,0.15)','rgba(148,163,184,0.15)','rgba(205,127,50,0.15)'][gi] : 'var(--bg)', border: '1px solid var(--border)', color: gi < 3 ? ['#F59E0B','#94A3B8','#CD7F32'][gi] : 'var(--text-muted)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {gi + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/profile/${s.id}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</Link>
                <p className="lb-group" style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.groups?.join(', ')}</p>
              </div>
              {s.attendance != null && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{s.attendance}% att.</span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: s.avg_score == null ? 'var(--text-muted)' : s.avg_score >= 80 ? '#14B8A8' : s.avg_score >= 60 ? '#F59E0B' : '#EF4444', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                {s.avg_score != null ? `${s.avg_score}%` : '—'}
              </span>
            </motion.div>
          )
        })}
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {(safePage - 1) * LB_PAGE_SIZE + 1}–{Math.min(safePage * LB_PAGE_SIZE, rows.length)} / {rows.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}>
              ← Oldingi
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${p === safePage ? 'var(--accent)' : 'var(--border)'}`, background: p === safePage ? 'var(--accent)' : 'transparent', color: p === safePage ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: safePage === pageCount ? 'default' : 'pointer', opacity: safePage === pageCount ? 0.4 : 1 }}>
              Keyingi →
            </button>
          </div>
        </div>
      )}

      {atRisk.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color="#EF4444" />
            <p style={{ fontWeight: 700, fontSize: 14, color: '#EF4444' }}>{t('dashboard.at_risk')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>({t('dashboard.below_80')})</span></p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {atRisk.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link to={`/profile/${s.id}`} style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</Link>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{s.groups?.join(', ')}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{s.avg_score}%</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
