import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Clock, Zap, ArrowLeft, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { getMatch } from '../api/tournament'

// ── Race Lane ─────────────────────────────────────────────────────────────────

function RaceLane({ player, progress, wpm, isMe, isWinner, isLoser }) {
  const name    = player?.first_name || player?.username || '?'
  const initial = name[0]?.toUpperCase() || '?'
  const pct     = Math.max(0, Math.min(progress || 0, 100))

  return (
    <div className={`transition-opacity duration-300 ${isLoser ? 'opacity-40' : 'opacity-100'}`}>
      {/* Name row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
            style={isMe
              ? { background: 'linear-gradient(135deg, #0D9488, #0F766E)', color: '#fff' }
              : { background: '#F1F5F9', color: '#64748B' }}
          >
            {isWinner ? '🏆' : initial}
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }} className="truncate max-w-[140px]">
            {name}
          </span>
          {isMe && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#0F766E',
              background: '#CCFBF1', padding: '2px 6px', borderRadius: 6,
            }}>
              YOU
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#0D9488' }}>
          {wpm || 0}
          <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 2 }}>wpm</span>
        </span>
      </div>

      {/* Track */}
      <div className="relative h-7">
        <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
          <motion.div
            style={{
              height: '100%', borderRadius: 999,
              background: isMe
                ? 'linear-gradient(90deg, #0D9488, #14B8A6)'
                : 'linear-gradient(90deg, #CBD5E1, #94A3B8)',
            }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
        <motion.span
          style={{ position: 'absolute', top: '50%', marginTop: -12, fontSize: 20, lineHeight: 1, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}
          animate={{ left: `${Math.min(pct, 90)}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
        >
          {isMe ? '🏎️' : '🚗'}
        </motion.span>
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.4, userSelect: 'none' }}>
          🏁
        </span>
      </div>
    </div>
  )
}

// ── Typing Area ───────────────────────────────────────────────────────────────

function TypingArea({ text, onProgress, active }) {
  const [typed,   setTyped]   = useState('')
  const [startMs, setStartMs] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  const handleChange = (e) => {
    if (!active) return
    const val = e.target.value
    if (val.length > text.length) return
    const now = Date.now()
    if (!startMs && val.length > 0) setStartMs(now)
    setTyped(val)
    const elapsed  = startMs ? (now - startMs) / 60000 : 0.00001
    const wpm      = Math.round((val.length / 5) / elapsed)
    let correct    = 0
    for (let i = 0; i < val.length; i++) if (val[i] === text[i]) correct++
    const accuracy = val.length > 0 ? Math.round((correct / val.length) * 100) : 100
    const progress = Math.min(100, Math.round((val.length / text.length) * 100))
    onProgress({ wpm, accuracy, progress, done: val === text })
  }

  return (
    <div
      onClick={() => active && inputRef.current?.focus()}
      style={{
        position: 'relative', padding: 32,
        borderRadius: 16, fontFamily: 'monospace',
        fontSize: '1.1rem', lineHeight: 2.2, letterSpacing: '0.02em',
        userSelect: 'none', cursor: active ? 'text' : 'default',
        border: `2px solid ${active ? '#0D9488' : '#E2E8F0'}`,
        background: active ? '#fff' : '#F8FAFC',
        boxShadow: active ? '0 4px 24px rgba(13,148,136,0.08)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      {text.split('').map((ch, i) => {
        let style = {}
        if (i < typed.length) {
          style = typed[i] === ch
            ? { color: '#1E293B' }
            : { color: '#EF4444', background: '#FEE2E2', borderRadius: 3 }
        } else if (i === typed.length && active) {
          style = { background: '#CCFBF1', borderRadius: 3, color: '#1E293B' }
        } else {
          style = { color: '#CBD5E1' }
        }
        return <span key={i} style={style}>{ch}</span>
      })}
      <input
        ref={inputRef}
        value={typed}
        onChange={handleChange}
        disabled={!active}
        className="sr-only"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
}

// ── Countdown Overlay ─────────────────────────────────────────────────────────

function CountdownOverlay({ count }) {
  return (
    <motion.div
      key={count}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 16, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
      }}
    >
      <p style={{
        fontSize: 96, fontWeight: 900, lineHeight: 1,
        color: count === 0 ? '#0D9488' : count === 1 ? '#F97316' : '#1E293B',
        textShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {count === 0 ? 'GO!' : count}
      </p>
    </motion.div>
  )
}

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({ event, myUserId, myStats, oppStats, onBack, navigateNext }) {
  const winner   = event.winner
  const isWinner = winner?.id === myUserId || winner?.user_id === myUserId
  const summary  = event.summary || {}
  const hasNext  = summary.next_match_id && !summary.tournament_finished

  const [autoSec, setAutoSec] = useState(hasNext ? 5 : null)
  useEffect(() => {
    if (autoSec === null) return
    if (autoSec <= 0) { navigateNext?.(); return }
    const t = setTimeout(() => setAutoSec(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [autoSec])

  const reasons = {
    finished:   'Finished the text first!',
    timeout:    'Time ran out — best WPM wins',
    disconnect: 'Opponent disconnected',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.82, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.06 }}
        style={{
          width: '100%', maxWidth: 380,
          background: '#fff', borderRadius: 24,
          padding: 32, boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}
            style={{
              width: 88, height: 88, borderRadius: 20, margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isWinner
                ? 'linear-gradient(135deg, #F59E0B, #F97316)'
                : '#F1F5F9',
              boxShadow: isWinner ? '0 8px 32px rgba(245,158,11,0.3)' : 'none',
            }}
          >
            {isWinner
              ? <Trophy size={40} color="#fff" />
              : <span style={{ fontSize: 44 }}>💪</span>
            }
          </motion.div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>
            {isWinner ? 'Victory!' : winner ? `${winner.first_name || winner.username} wins` : 'Match over'}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B' }}>
            {reasons[event.reason] || event.reason}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Your WPM', value: myStats?.wpm || 0, bg: '#F0FDFA', color: '#0F766E' },
            { label: 'Opp WPM',  value: oppStats?.wpm || 0, bg: '#F8FAFC', color: '#475569' },
            { label: 'Accuracy', value: `${myStats?.accuracy ?? 100}%`, bg: '#F0FDF4', color: '#15803D' },
            { label: 'Completed', value: `${Math.round(myStats?.progress || 0)}%`, bg: '#F0FDFA', color: '#0F766E' },
          ].map(({ label, value, bg, color }) => (
            <div key={label} style={{ background: bg, borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Champion badge */}
        {summary.tournament_finished && isWinner && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10,
            background: '#FEF3C7', color: '#92400E',
            fontSize: 13, fontWeight: 600, marginBottom: 14,
          }}>
            <Trophy size={14} /> Tournament Champion! 🏆
          </div>
        )}

        {hasNext ? (
          <button onClick={navigateNext} style={{ ...primaryBtn, width: '100%', justifyContent: 'center', fontSize: 14 }}>
            <Zap size={15} />
            Next Match
            {autoSec !== null && autoSec > 0 && (
              <span style={{ marginLeft: 4, opacity: 0.7, fontWeight: 400 }}>({autoSec}s)</span>
            )}
          </button>
        ) : (
          <button onClick={onBack} style={{ ...primaryBtn, width: '100%', justifyContent: 'center', fontSize: 14 }}>
            Back to Bracket
          </button>
        )}
        {hasNext && (
          <button onClick={onBack} style={{ display: 'block', width: '100%', marginTop: 8, padding: '10px 0', fontSize: 13, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
            Back to Bracket
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchRoom() {
  const { matchId }  = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()

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
        clearInterval(timerRef.current)
        timerRef.current = null
        setTimeUp(true)
      }
    }, 1000)
  }, [])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const { send } = useWebSocket(`/ws/tournament/match/${matchId}/`, {
    onMessage: useCallback((msg) => {
      switch (msg.type) {
        case 'match_state':
          setMatchState(msg)
          setTimeLeft(msg.time_limit)
          timeLimitRef.current = msg.time_limit
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #0D9488', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#94A3B8', fontWeight: 500 }}>Loading match…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const myId        = user?.id
  const isMe        = (p) => p?.user_id === myId || p?.id === myId
  const me          = isMe(matchState.player1) ? matchState.player1 : matchState.player2
  const opp         = isMe(matchState.player1) ? matchState.player2 : matchState.player1
  const isActive    = matchStarted && countdown === null && !finishedEvent && !myFinished && !timeUp
  const timePct     = timeLimitRef.current > 0 ? ((timeLeft ?? timeLimitRef.current) / timeLimitRef.current) * 100 : 100
  const timeCrit    = timeLeft !== null && timeLeft <= 10
  const winnerUid   = finishedEvent?.winner?.id ?? finishedEvent?.winner?.user_id
  const myWin       = winnerUid === myId
  const oppWin      = winnerUid != null && winnerUid !== myId
  const summary     = finishedEvent?.summary || {}
  const nextMatchId = summary.next_match_id
  const navigateNext = nextMatchId
    ? () => navigate(`/tournament/match/${nextMatchId}`)
    : () => navigate(matchState?.join_code ? `/tournament/${matchState.join_code}` : '/tournament')

  return (
    <>
      {finishedEvent && (
        <ResultScreen
          event={finishedEvent} myUserId={myId}
          myStats={myStats} oppStats={oppStats}
          onBack={() => navigate(matchState.join_code ? `/tournament/${matchState.join_code}` : '/tournament')}
          navigateNext={navigateNext}
        />
      )}

      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '40px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => navigate(matchState.join_code ? `/tournament/${matchState.join_code}` : '/tournament')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ArrowLeft size={16} /> Bracket
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8' }}>
              {matchState.round_name}
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10,
              fontFamily: 'monospace', fontWeight: 800, fontSize: 13,
              background: timeCrit ? '#FEF2F2' : '#fff',
              border: `1px solid ${timeCrit ? '#FECACA' : '#E2E8F0'}`,
              color: timeCrit ? '#EF4444' : '#1E293B',
              animation: timeCrit ? 'pulse 1s ease-in-out infinite' : 'none',
            }}>
              <Clock size={13} />
              {timeLeft !== null ? `${timeLeft}s` : `${timeLimitRef.current}s`}
            </div>
          </div>

          {/* ── Timer bar ── */}
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', borderRadius: 99, background: timeCrit ? '#EF4444' : '#0D9488', transition: 'background 0.5s' }}
              animate={{ width: `${Math.max(0, timePct)}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          {/* ── Race tracks ── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!matchState.is_spectator && me && (
              <RaceLane player={me} progress={myStats.progress} wpm={myStats.wpm} isMe isWinner={myWin} isLoser={oppWin} />
            )}
            {opp && (
              <RaceLane player={opp} progress={oppStats.progress} wpm={oppStats.wpm} isMe={false} isWinner={oppWin} isLoser={myWin} />
            )}
            {oppDisconnected && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', fontSize: 13, color: '#D97706', fontWeight: 500 }}>
                ⚡ Opponent disconnected — awarding win in 10s…
              </motion.p>
            )}
          </div>

          {/* ── Typing section ── */}
          {matchState.is_spectator ? (
            <div style={{ background: '#fff', borderRadius: 20, padding: 48, border: '1px solid #E2E8F0', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <Eye size={32} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#94A3B8', fontWeight: 500 }}>You're spectating this match</p>
            </div>

          ) : timeUp && !finishedEvent ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: '#FFF7ED', borderRadius: 20, padding: 40, border: '2px solid #FED7AA', textAlign: 'center' }}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>⏰</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#C2410C' }}>Time's up!</p>
              <p style={{ fontSize: 13, color: '#EA580C', marginTop: 4 }}>Calculating results…</p>
            </motion.div>

          ) : myFinished && !finishedEvent ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: '#F0FDF4', borderRadius: 20, padding: 40, border: '2px solid #BBF7D0', textAlign: 'center' }}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>✅</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#15803D' }}>Finished!</p>
              <p style={{ fontSize: 13, color: '#16A34A', marginTop: 4 }}>Waiting for your opponent…</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 20, paddingTop: 20, borderTop: '1px solid #BBF7D0' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#0D9488' }}>{myStats.wpm}</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>WPM</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#16A34A' }}>{myStats.accuracy}%</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accuracy</p>
                </div>
              </div>
            </motion.div>

          ) : (
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              {!matchStarted && (
                <div style={{ padding: '20px 32px 8px' }}>
                  <motion.p
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', fontWeight: 500 }}
                  >
                    Waiting for both players to connect…
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', gap: 32 }}>
                    {[
                      { label: 'WPM', value: myStats.wpm, color: '#0D9488' },
                      { label: 'Accuracy', value: `${myStats.accuracy}%`, color: '#16A34A' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
                        <p style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 22, fontWeight: 900, color: '#0D9488', lineHeight: 1 }}>{Math.round(myStats.progress)}%</p>
                    <p style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>Progress</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }`}</style>
    </>
  )
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '12px 24px', borderRadius: 12, border: 'none',
  background: '#0D9488', color: '#fff', fontWeight: 700,
  fontSize: 14, cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
  transition: 'background 0.15s, transform 0.1s',
}