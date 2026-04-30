import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Clock, Zap, ArrowLeft, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { getMatch } from '../api/tournament'
import { useTranslation } from 'react-i18next'

// Hardcoded light palette — this page is always light regardless of app theme
const L = {
  bg:        '#F8F9FB',
  surface:   '#FFFFFF',
  border:    '#E2E8F0',
  text:      '#0F1923',
  muted:     '#64748B',
  accent:    '#0D9488',
  accentDim: 'rgba(13,148,136,0.1)',
  violet:    '#7C3AED',
  violetDim: 'rgba(124,58,237,0.08)',
  amber:     '#D97706',
  amberDim:  'rgba(217,119,6,0.07)',
  red:       '#DC2626',
  green:     '#059669',
  greenDim:  'rgba(5,150,105,0.07)',
  mono:      "'JetBrains Mono', monospace",
}

// ── Shared stat display ────────────────────────────────────────────────────────

function StatItem({ label, value, color, size = 24 }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: L.mono, fontSize: size, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, color: L.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
    </div>
  )
}

// ── Race Lane ──────────────────────────────────────────────────────────────────

function RaceLane({ player, progress, wpm, isMe, isWinner, isLoser }) {
  const { t } = useTranslation()
  const name    = player?.first_name || player?.username || '?'
  const initial = name[0]?.toUpperCase() || '?'
  const pct     = Math.max(0, Math.min(progress || 0, 100))

  const laneColor = isWinner ? 'rgba(217,119,6,0.4)' : isMe ? 'rgba(124,58,237,0.4)' : L.border
  const laneBg    = isWinner ? L.amberDim : isLoser ? 'transparent' : isMe ? L.violetDim : L.surface
  const avatarBg  = isWinner ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                  : isMe     ? 'linear-gradient(135deg,#7C3AED,#6366F1)'
                  : L.border
  const barBg     = isWinner ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                  : isMe     ? 'linear-gradient(90deg,#7C3AED,#818CF8)'
                  : 'linear-gradient(90deg,#E2E8F0,#CBD5E1)'

  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${laneColor}`, padding: '16px 18px',
      background: laneBg, opacity: isLoser ? 0.55 : 1, transition: 'all 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, background: avatarBg,
            color: isMe || isWinner ? '#fff' : L.text,
            boxShadow: isMe ? '0 6px 18px rgba(124,58,237,0.25)' : isWinner ? '0 6px 18px rgba(217,119,6,0.25)' : 'none',
          }}>
            {isWinner ? '🏆' : initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: L.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </p>
            {isMe && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', fontSize: 9, fontWeight: 900,
                color: L.violet, background: L.violetDim, borderRadius: 99,
                padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>{t('tournament.you_label')}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontFamily: L.mono, fontWeight: 900, fontSize: 20, color: L.text, lineHeight: 1 }}>{wpm || 0}</p>
          <p style={{ fontSize: 9, fontWeight: 600, color: L.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>wpm</p>
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', background: L.bg, border: `1px solid ${L.border}`, position: 'relative' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 99, background: barBg }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        />
        <motion.span
          style={{ position: 'absolute', top: '50%', translateY: '-50%', fontSize: 12, lineHeight: 1, userSelect: 'none' }}
          animate={{ left: `calc(${Math.min(pct, 88)}% - 6px)` }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        >{isMe ? '🚀' : '✨'}</motion.span>
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10 }}>🏁</span>
      </div>
    </div>
  )
}

// ── Typing Area ────────────────────────────────────────────────────────────────

function TypingArea({ text, onProgress, active }) {
  const [typed,   setTyped]   = useState('')
  const [startMs, setStartMs] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  const handleChange = useCallback((e) => {
    if (!active) return
    const val = e.target.value
    if (val.length > text.length) return
    const now = Date.now()
    if (!startMs && val.length > 0) setStartMs(now)
    setTyped(val)
    const elapsed  = startMs ? (now - startMs) / 60000 : 0.00001
    const wpm      = Math.round((val.length / 5) / elapsed)
    let correct = 0
    for (let i = 0; i < val.length; i++) if (val[i] === text[i]) correct++
    const accuracy = val.length > 0 ? Math.round((correct / val.length) * 100) : 100
    const progress = Math.min(100, Math.round((val.length / text.length) * 100))
    onProgress({ wpm, accuracy, progress, done: val === text })
  }, [active, text, startMs, onProgress])

  // Render typed chars individually (correct/wrong), cursor, then rest as one span
  const chars = useMemo(() => {
    const result = []
    for (let i = 0; i < typed.length; i++) {
      result.push(typed[i] === text[i]
        ? <span key={i} style={{ color: L.text }}>{text[i]}</span>
        : <span key={i} style={{ color: L.red, background: 'rgba(220,38,38,0.1)', borderRadius: 3 }}>{text[i]}</span>
      )
    }
    if (active && typed.length < text.length) {
      result.push(
        <span key="cursor" style={{ background: L.accent, color: '#fff', borderRadius: 3 }}>{text[typed.length]}</span>
      )
    }
    const restStart = typed.length + (active ? 1 : 0)
    if (restStart < text.length) {
      result.push(<span key="rest" style={{ color: L.muted }}>{text.slice(restStart)}</span>)
    }
    return result
  }, [typed, active, text])

  return (
    <div
      onClick={() => active && inputRef.current?.focus()}
      style={{
        position: 'relative', cursor: active ? 'text' : 'default',
        padding: '26px 22px', borderRadius: 16,
        fontFamily: L.mono,
        fontSize: 'clamp(0.9rem, 2.2vw, 1.1rem)',
        lineHeight: 2.4, letterSpacing: '0.02em',
        userSelect: 'none',
        background: L.surface,
        border: `1.5px solid ${active ? L.accent : L.border}`,
        boxShadow: active
          ? `0 0 0 3px ${L.accentDim}, 0 8px 24px rgba(0,0,0,0.06)`
          : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        overflowWrap: 'break-word', wordBreak: 'break-word',
      }}
    >
      {chars}
      <input
        ref={inputRef} value={typed} onChange={handleChange}
        disabled={!active} className="sr-only"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      />
    </div>
  )
}

// ── Countdown Overlay ──────────────────────────────────────────────────────────

function CountdownOverlay({ count }) {
  const { t } = useTranslation()
  return (
    <motion.div
      key={count}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        position: 'absolute', inset: 0, zIndex: 20, borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(248,249,251,0.93)', backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.p
          animate={{ scale: count === 0 ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.35 }}
          style={{
            fontSize: 'clamp(60px, 11vw, 88px)', fontWeight: 900, lineHeight: 1, marginBottom: 10,
            color: count === 0 ? L.accent : count === 1 ? L.amber : L.text,
          }}
        >
          {count === 0 ? t('tournament.go_label') : count}
        </motion.p>
        <p style={{ color: L.muted, fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {count === 0 ? t('tournament.type_now') : t('tournament.get_ready')}
        </p>
      </div>
    </motion.div>
  )
}

// ── Result Screen ──────────────────────────────────────────────────────────────

function ResultScreen({ event, myUserId, myStats, oppStats, onBack, navigateNext }) {
  const { t } = useTranslation()
  const winner   = event.winner
  const isWinner = winner?.id === myUserId || winner?.user_id === myUserId
  const summary  = event.summary || {}
  const hasNext  = summary.next_match_id && !summary.tournament_finished

  const [autoSec, setAutoSec] = useState(hasNext ? 5 : null)
  useEffect(() => {
    if (autoSec === null) return
    if (autoSec <= 0) { navigateNext?.(); return }
    const timer = setTimeout(() => setAutoSec(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [autoSec])

  const REASONS = {
    finished:   t('tournament.reason_finished'),
    timeout:    t('tournament.reason_timeout'),
    disconnect: t('tournament.reason_disconnect'),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.05 }}
        style={{
          width: '100%', maxWidth: 420, borderRadius: 24, overflow: 'hidden',
          background: L.surface, border: `1px solid ${L.border}`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{
          background: isWinner ? 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(99,102,241,0.05))' : L.bg,
          borderBottom: `1px solid ${L.border}`, padding: '28px 28px 22px', textAlign: 'center',
        }}>
          <motion.div
            initial={{ scale: 0, rotate: -18 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 260, damping: 14 }}
            style={{
              width: 76, height: 76, borderRadius: 22, margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isWinner ? 'linear-gradient(135deg,#7C3AED,#6366F1)' : L.border,
              boxShadow: isWinner ? '0 14px 44px rgba(124,58,237,0.28)' : 'none',
            }}
          >
            {isWinner ? <Trophy size={34} color="#fff" /> : <span style={{ fontSize: 34 }}>💪</span>}
          </motion.div>
          <h2 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900, color: L.text, marginBottom: 6 }}>
            {isWinner ? t('tournament.victory') : winner ? t('tournament.player_wins', { name: winner.first_name || winner.username }) : t('tournament.match_over')}
          </h2>
          <p style={{ fontSize: 13, color: L.muted, fontWeight: 500 }}>{REASONS[event.reason] || event.reason}</p>
        </div>

        <div style={{ padding: '22px 22px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
            {[
              { label: t('tournament.your_wpm'),       value: myStats?.wpm || 0,              color: L.violet },
              { label: t('tournament.opp_wpm'),        value: oppStats?.wpm || 0,             color: L.muted  },
              { label: t('tournament.accuracy_label'), value: `${myStats?.accuracy ?? 100}%`, color: L.green  },
              { label: t('tournament.progress_label'), value: `${Math.round(myStats?.progress || 0)}%`, color: L.accent },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: L.bg, borderRadius: 14,
                padding: '13px 10px', border: `1px solid ${L.border}`, textAlign: 'center',
              }}>
                <p style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 9, color: L.muted, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {summary.tournament_finished && isWinner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 14px', borderRadius: 12, marginBottom: 16,
                background: L.amberDim, border: `1px solid rgba(217,119,6,0.2)`,
                color: L.amber, fontSize: 13, fontWeight: 700,
              }}
            >
              <Trophy size={14} /> {t('tournament.champion')} 🏆
            </motion.div>
          )}

          <button
            onClick={hasNext ? navigateNext : onBack}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 22px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#6366F1)',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 10px 36px rgba(124,58,237,0.28)',
            }}
          >
            {hasNext ? (
              <>
                <Zap size={16} /> {t('tournament.next_match')}
                {autoSec > 0 && <span style={{ opacity: 0.6, fontWeight: 500, fontSize: 13 }}>({autoSec}s)</span>}
              </>
            ) : t('tournament.back_bracket')}
          </button>

          {hasNext && (
            <button onClick={onBack} style={{
              display: 'block', width: '100%', marginTop: 9,
              padding: '11px 0', fontSize: 13, color: L.muted,
              background: 'transparent', border: `1px solid ${L.border}`,
              borderRadius: 12, cursor: 'pointer', fontWeight: 600,
            }}>
              {t('tournament.back_bracket')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MatchRoom() {
  const { matchId } = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { t }       = useTranslation()

  const [matchState,      setMatchState]      = useState(null)
  const [matchStarted,    setMatchStarted]    = useState(false)
  const [myFinished,      setMyFinished]      = useState(false)
  const [timeUp,          setTimeUp]          = useState(false)
  const [countdown,       setCountdown]       = useState(null)
  const [myStats,         setMyStats]         = useState({ wpm: 0, accuracy: 100, progress: 0 })
  const [oppStats,        setOppStats]        = useState({ wpm: 0, accuracy: 100, progress: 0 })
  const [timeLeft,        setTimeLeft]        = useState(null)
  const [finishedEvent,   setFinishedEvent]   = useState(null)
  const [oppDisconnected, setOppDisconnected] = useState(false)
  const timerRef     = useRef(null)
  const timeLimitRef = useRef(60)

  useEffect(() => {
    getMatch(matchId)
      .then(r => {
        setMatchState(r.data)
        setTimeLeft(r.data.time_limit)
        timeLimitRef.current = r.data.time_limit
        if (r.data.status === 'active') setMatchStarted(true)
      })
      .catch(() => navigate('/tournament'))
  }, [matchId])

  const startTimer = useCallback(() => {
    if (timerRef.current) return
    let remaining = timeLimitRef.current
    setTimeLeft(remaining)
    timerRef.current = setInterval(() => {
      remaining -= 1
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current); timerRef.current = null; setTimeUp(true)
      }
    }, 1000)
  }, [])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const { send } = useWebSocket(`/ws/tournament/match/${matchId}/`, {
    onMessage: useCallback((msg) => {
      switch (msg.type) {
        case 'match_state':
          setMatchState(msg); setTimeLeft(msg.time_limit); timeLimitRef.current = msg.time_limit
          if (msg.status === 'active') { setMatchStarted(true); startTimer() }
          break
        case 'match_activated':
          setMatchStarted(true); setOppDisconnected(false); break
        case 'countdown':
          setCountdown(msg.count)
          if (msg.count === 0) { setTimeout(() => setCountdown(null), 900); startTimer() }
          break
        case 'opponent_progress':
          if (Number(msg.user_id) !== Number(user?.id)) {
            setOppStats({ wpm: msg.wpm, accuracy: msg.accuracy, progress: msg.progress })
            setOppDisconnected(false)
          }
          break
        case 'match_finished':
          clearInterval(timerRef.current); timerRef.current = null; setFinishedEvent(msg); break
        case 'opponent_disconnected':
          setOppDisconnected(true); break
        default: break
      }
    }, [user?.id, startTimer]),
  })

  const lastSendRef = useRef(0)
  const handleProgress = useCallback(({ wpm, accuracy, progress, done }) => {
    setMyStats({ wpm, accuracy, progress })
    const now = Date.now()
    if (now - lastSendRef.current >= 150 || progress >= 100 || done) {
      lastSendRef.current = now
      send({ type: 'typing_update', wpm, accuracy, progress })
    }
    if (progress >= 100 || done) setMyFinished(true)
  }, [send])

  if (!matchState) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: L.bg }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `2.5px solid ${L.border}`, borderTopColor: L.accent, borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: L.muted, fontWeight: 600, fontSize: 13 }}>{t('tournament.loading_match')}</p>
        </div>
      </div>
    )
  }

  const myId     = user?.id
  const isMe     = (p) => p?.user_id === myId || p?.id === myId
  const me       = isMe(matchState.player1) ? matchState.player1 : matchState.player2
  const opp      = isMe(matchState.player1) ? matchState.player2 : matchState.player1
  const isActive = matchStarted && countdown === null && !finishedEvent && !myFinished && !timeUp
  const timePct  = timeLimitRef.current > 0 ? ((timeLeft ?? timeLimitRef.current) / timeLimitRef.current) * 100 : 100
  const timeCrit = timeLeft !== null && timeLeft <= 10

  const winnerUid    = finishedEvent?.winner?.id ?? finishedEvent?.winner?.user_id
  const myWin        = winnerUid === myId
  const oppWin       = winnerUid != null && winnerUid !== myId
  const summary      = finishedEvent?.summary || {}
  const backHref     = matchState.join_code ? `/tournament/${matchState.join_code}` : '/tournament'
  const navigateNext = summary.next_match_id
    ? () => navigate(`/tournament/match/${summary.next_match_id}`)
    : () => navigate(backHref)

  return (
    <>
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes pulse-crit { 0%,100% { opacity:1 } 50% { opacity:.5 } }
      `}</style>

      {finishedEvent && (
        <ResultScreen
          event={finishedEvent} myUserId={myId}
          myStats={myStats} oppStats={oppStats}
          onBack={() => navigate(backHref)}
          navigateNext={navigateNext}
        />
      )}

      <div style={{ minHeight: '100vh', background: L.bg, padding: 'clamp(16px,4vw,36px) clamp(12px,3vw,20px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,2.5vw,18px)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={() => navigate(backHref)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 700, color: L.muted,
                background: L.surface, border: `1px solid ${L.border}`,
                borderRadius: 11, padding: '8px 13px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <ArrowLeft size={14} /><span>{t('tournament.bracket_btn')}</span>
            </button>

            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: L.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {matchState.round_name}
            </span>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 99, flexShrink: 0,
              fontFamily: L.mono, fontWeight: 800, fontSize: 13,
              background: timeCrit ? 'rgba(220,38,38,0.08)' : 'rgba(124,58,237,0.08)',
              border: `1px solid ${timeCrit ? 'rgba(220,38,38,0.25)' : 'rgba(124,58,237,0.25)'}`,
              color: timeCrit ? L.red : L.violet,
              animation: timeCrit ? 'pulse-crit 1s ease-in-out infinite' : 'none',
            }}>
              <Clock size={12} />
              {timeLeft !== null ? `${timeLeft}s` : `${timeLimitRef.current}s`}
            </div>
          </div>

          {/* Timer bar */}
          <div style={{ height: 3, background: L.border, borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              style={{
                height: '100%', borderRadius: 99, transition: 'background 0.5s',
                background: timeCrit
                  ? `linear-gradient(90deg,${L.red},#FCA5A5)`
                  : 'linear-gradient(90deg,#7C3AED,#818CF8)',
              }}
              animate={{ width: `${Math.max(0, timePct)}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          {/* Race Tracks */}
          <div style={{
            background: L.surface, borderRadius: 20, padding: 'clamp(14px,3vw,20px)',
            border: `1px solid ${L.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {!matchState.is_spectator && me && (
              <RaceLane player={me} progress={myStats.progress} wpm={myStats.wpm} isMe isWinner={myWin} isLoser={oppWin} />
            )}
            {opp ? (
              <RaceLane player={opp} progress={oppStats.progress} wpm={oppStats.wpm} isWinner={oppWin} isLoser={myWin} />
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px dashed ${L.border}`, textAlign: 'center' }}>
                <p style={{ color: L.muted, fontSize: 13, fontWeight: 500 }}>{t('tournament.waiting_opponent')}</p>
              </div>
            )}
            {oppDisconnected && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: L.amberDim, border: `1px solid rgba(217,119,6,0.2)`,
                  borderRadius: 11, padding: '10px 14px', textAlign: 'center',
                  fontSize: 13, color: L.amber, fontWeight: 600,
                }}
              >
                {t('tournament.opp_disconnected')}
              </motion.div>
            )}
          </div>

          {/* Typing Section */}
          {matchState.is_spectator ? (
            <div style={{
              background: L.surface, borderRadius: 18, padding: 40,
              border: `1px solid ${L.border}`, textAlign: 'center',
            }}>
              <Eye size={30} color={L.muted} style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ color: L.muted, fontWeight: 600, fontSize: 14 }}>{t('tournament.spectating')}</p>
            </div>

          ) : timeUp && !finishedEvent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: L.amberDim, borderRadius: 18, padding: 40,
                border: `1px solid rgba(217,119,6,0.18)`, textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 42, marginBottom: 12 }}>⏰</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: L.amber }}>{t('tournament.times_up')}</p>
              <p style={{ fontSize: 13, color: L.muted, marginTop: 5 }}>{t('tournament.calculating')}</p>
            </motion.div>

          ) : myFinished && !finishedEvent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: L.greenDim, borderRadius: 18, padding: 36,
                border: `1px solid rgba(5,150,105,0.18)`, textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: L.green }}>{t('tournament.finished_text')}</p>
              <p style={{ fontSize: 13, color: L.muted, marginTop: 5 }}>{t('tournament.waiting_opp_result')}</p>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 48,
                marginTop: 22, paddingTop: 22, borderTop: `1px solid rgba(5,150,105,0.12)`,
              }}>
                <StatItem label={t('tournament.wpm_label')}      value={myStats.wpm}            color={L.violet} size={28} />
                <StatItem label={t('tournament.accuracy_label')} value={`${myStats.accuracy}%`} color={L.green}  size={28} />
              </div>
            </motion.div>

          ) : (
            <div style={{
              background: L.surface, borderRadius: 20,
              border: `1px solid ${L.border}`, overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}>
              {!matchStarted && (
                <div style={{ padding: '14px 22px 0' }}>
                  <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ textAlign: 'center', fontSize: 13, color: L.muted, fontWeight: 500 }}
                  >
                    {t('tournament.waiting_both')}
                  </motion.p>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <AnimatePresence>
                  {countdown !== null && <CountdownOverlay key={countdown} count={countdown} />}
                </AnimatePresence>
                <TypingArea text={matchState.text || ''} onProgress={handleProgress} active={isActive} />
              </div>

              {matchStarted && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                  padding: 'clamp(12px,3vw,18px) clamp(16px,4vw,26px)',
                  background: L.bg, borderTop: `1px solid ${L.border}`,
                }}>
                  <div style={{ display: 'flex', gap: 'clamp(20px,5vw,44px)' }}>
                    <StatItem label={t('tournament.wpm_label')}      value={myStats.wpm}            color={L.violet} size="clamp(18px,4vw,24px)" />
                    <StatItem label={t('tournament.accuracy_label')} value={`${myStats.accuracy}%`} color={L.green}  size="clamp(18px,4vw,24px)" />
                  </div>
                  <StatItem label={t('tournament.progress_label')} value={`${Math.round(myStats.progress)}%`} color={L.accent} size="clamp(18px,4vw,24px)" />
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
