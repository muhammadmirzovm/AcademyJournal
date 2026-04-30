import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, Users, Clock, Copy, Check, Swords,
  Eye, Play, Zap, Shield, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { createTournament, joinTournament, getBracket, getTournament, walkoverMatch } from '../api/tournament'
import { useTranslation } from 'react-i18next'

const avatar      = (p) => (p?.first_name?.[0] || p?.username?.[0] || '?').toUpperCase()
const displayName = (p) => p?.first_name || p?.username || 'Unknown'

// ─── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({ match, myUserId, isTeacher, onMatchClick, onWalkover }) {
  const { t } = useTranslation()
  const p1 = match.player1
  const p2 = match.player2
  const isMyMatch = (p1?.user_id === myUserId || p2?.user_id === myUserId) &&
    match.status !== 'finished' && match.status !== 'bye'
  const isDone  = match.status === 'finished' || match.status === 'bye'
  const canSkip = isTeacher && !isDone
  const [skipLoading, setSkipLoading] = useState(false)

  const handleSkip = async (e, winnerId) => {
    e.stopPropagation()
    setSkipLoading(true)
    try { await onWalkover(match.id, winnerId) } finally { setSkipLoading(false) }
  }

  return (
    <motion.div
      whileHover={isMyMatch ? { y: -3, scale: 1.02 } : {}}
      onClick={() => isMyMatch && onMatchClick(match.id)}
      style={{
        width: 196,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1.5px solid ${isMyMatch ? 'var(--accent)' : 'var(--border)'}`,
        background: isMyMatch ? 'var(--accent-bg)' : isDone ? 'var(--bg)' : 'var(--surface)',
        cursor: isMyMatch ? 'pointer' : 'default',
        boxShadow: isMyMatch ? '0 6px 20px rgba(13,148,136,0.18)' : 'none',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      {isMyMatch && (
        <div style={{ background: 'var(--accent)', padding: '5px 10px', textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {t('tournament.your_match')}
          </span>
        </div>
      )}

      {[p1, p2].map((p, i) => {
        const isWinner = isDone && match.winner?.user_id === p?.user_id
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
            background: isWinner ? 'var(--accent-bg)' : 'transparent',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              background: isWinner ? 'var(--accent)' : p ? 'var(--border)' : 'transparent',
              color: isWinner ? '#fff' : 'var(--text)',
              border: p ? 'none' : '1px dashed var(--border)',
            }}>
              {isWinner ? '🏆' : p ? avatar(p) : '?'}
            </div>
            <span style={{
              fontSize: 12, fontWeight: isWinner ? 700 : 500,
              color: isWinner ? 'var(--accent)' : p ? 'var(--text)' : 'var(--text-muted)',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontStyle: p ? 'normal' : 'italic',
            }}>
              {p ? displayName(p) : t('tournament.tbd')}
            </span>
            {canSkip && p && (
              <button
                onClick={(e) => handleSkip(e, p.user_id)}
                disabled={skipLoading}
                title={`${displayName(p)} wins`}
                style={{
                  width: 22, height: 22, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: 'rgba(5,150,105,0.15)', color: 'var(--success)',
                  fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✓</button>
            )}
          </div>
        )
      })}

      {canSkip && (
        <div style={{ padding: '5px 12px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('tournament.set_winner_hint')}</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Bracket View ──────────────────────────────────────────────────────────────

function BracketView({ bracket, myUserId, isTeacher, onMatchClick, onWalkover }) {
  if (!bracket?.rounds?.length) return null

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', gap: 28, minWidth: 'max-content', padding: '4px 2px 12px' }}>
        {bracket.rounds.map((round) => (
          <div key={round.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              padding: '4px 14px', borderRadius: 20, fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              background: round.status === 'active'
                ? 'var(--accent-bg)'
                : round.status === 'finished'
                ? 'rgba(5,150,105,0.08)'
                : 'var(--bg)',
              color: round.status === 'active'
                ? 'var(--accent)'
                : round.status === 'finished'
                ? 'var(--success)'
                : 'var(--text-muted)',
              border: `1px solid ${round.status === 'active'
                ? 'var(--accent)'
                : round.status === 'finished'
                ? 'rgba(5,150,105,0.25)'
                : 'var(--border)'}`,
            }}>
              {round.round_name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'space-around' }}>
              {round.matches.map((match) => (
                <MatchCard
                  key={match.id} match={match} myUserId={myUserId}
                  isTeacher={isTeacher} onMatchClick={onMatchClick} onWalkover={onWalkover}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Standings ─────────────────────────────────────────────────────────────────

const MEDAL = ['🥇', '🥈', '🥉']

function Standings({ participants }) {
  const { t } = useTranslation()
  const sorted = [...participants]
    .filter(p => p.final_position != null)
    .sort((a, b) => a.final_position - b.final_position)
  const active = participants.filter(p => p.final_position == null)

  if (sorted.length === 0 && active.length === 0) return null

  const nm  = p => p.first_name || p.username || '?'
  const ini = p => nm(p)[0].toUpperCase()

  const podium        = sorted.slice(0, 3)
  const rest          = sorted.slice(3)
  const podiumDisplay = podium.length >= 2
    ? [podium[1], podium[0], podium[2]].filter(Boolean)
    : podium

  const podiumHeights = { 1: 76, 2: 52, 3: 38 }
  const podiumColors  = {
    1: 'linear-gradient(135deg, #F59E0B, #D97706)',
    2: 'linear-gradient(135deg, #94A3B8, #64748B)',
    3: 'linear-gradient(135deg, #F97316, #EA580C)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      style={{ marginTop: 36 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Trophy size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {sorted.some(p => p.final_position === 1) ? t('tournament.final_standings') : t('tournament.live_standings')}
        </h3>
      </div>

      {podiumDisplay.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          {podiumDisplay.map((p) => {
            const pos  = p.final_position
            const h    = podiumHeights[pos] || 38
            const grad = podiumColors[pos]  || 'linear-gradient(135deg,#6B7280,#4B5563)'
            return (
              <motion.div
                key={p.user_id}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * pos, type: 'spring', stiffness: 220, damping: 20 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 90 }}
              >
                <div style={{ position: 'relative' }}>
                  {pos === 1 && (
                    <motion.div
                      animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}
                      style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 18, userSelect: 'none' }}
                    >👑</motion.div>
                  )}
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, background: grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900, color: '#fff',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                  }}>
                    {ini(p)}
                  </div>
                </div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.3 }}>{nm(p)}</p>
                {p.best_wpm > 0 && (
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(p.best_wpm)} wpm</p>
                )}
                <div style={{
                  width: '100%', height: h, background: grad,
                  borderRadius: '10px 10px 0 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                }}>
                  <span style={{ fontSize: 20 }}>{MEDAL[pos - 1] || pos}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {(rest.length > 0 || active.length > 0) && (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
          {rest.map((p, idx) => (
            <div key={p.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px',
              borderBottom: idx < rest.length - 1 || active.length > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ width: 26, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>
                {p.final_position}
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: 'var(--text)',
              }}>
                {ini(p)}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{nm(p)}</span>
              {p.best_wpm > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(p.best_wpm)} wpm</span>
              )}
              {p.best_accuracy > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginLeft: 8 }}>
                  {Math.round(p.best_accuracy)}%
                </span>
              )}
            </div>
          ))}

          {active.length > 0 && (
            <>
              {rest.length > 0 && (
                <div style={{ padding: '7px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    {t('tournament.still_playing')}
                  </span>
                </div>
              )}
              {active.map((p, idx) => (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  borderBottom: idx < active.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ width: 26, display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--success)',
                      display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite',
                    }} />
                  </span>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, background: 'var(--accent-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'var(--accent)',
                  }}>
                    {ini(p)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{nm(p)}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--success)',
                    background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)',
                    padding: '3px 8px', borderRadius: 20,
                  }}>
                    {t('tournament.active_label')}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Role Select ───────────────────────────────────────────────────────────────

function RoleSelect({ tournament, onPlay, onWatch, loading }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '32px 16px' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{ width: '100%', maxWidth: 400 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block', marginBottom: 18 }}
          >
            <div style={{
              width: 84, height: 84, borderRadius: 22, margin: '0 auto',
              background: 'linear-gradient(135deg, var(--accent), #0891B2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 44px rgba(13,148,136,0.28)',
            }}>
              <Trophy size={38} color="#fff" />
            </div>
          </motion.div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
            color: 'var(--text)', marginBottom: 8,
          }}>
            {tournament.name}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {tournament.participant_count} / {tournament.max_players} players · {tournament.time_limit}s per round
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onPlay}
            disabled={loading || tournament.is_full}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              padding: '28px 16px', borderRadius: 18,
              border: '2px solid var(--accent)', background: 'var(--accent-bg)',
              cursor: tournament.is_full || loading ? 'not-allowed' : 'pointer',
              opacity: tournament.is_full ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 15, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(13,148,136,0.3)',
            }}>
              <Play size={22} color="#fff" fill="#fff" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
                {t('tournament.join_as_player')}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tournament.is_full ? t('tournament.room_full') : t('tournament.compete_win')}
              </p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onWatch}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              padding: '28px 16px', borderRadius: 18,
              border: '1px solid var(--border)', background: 'var(--surface)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 15, background: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', fontSize: 24,
            }}>
              👻
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{t('tournament.ghost')}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('tournament.ghost_desc')}</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Lobby Room ────────────────────────────────────────────────────────────────

function LobbyRoom({ state, onStart, wsError, onClearError }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(state.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filled  = state.participant_count || 0
  const max     = state.max_players || 8
  const fillPct = Math.min(100, (filled / max) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '70vh', padding: '32px 16px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{
            width: 58, height: 58, borderRadius: 17, margin: '0 auto 14px',
            background: 'var(--accent-bg)', border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={24} color="var(--accent)" />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
            color: 'var(--text)', marginBottom: 10,
          }}>
            {state.name}
          </h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: state.is_participant ? 'var(--accent-bg)' : 'var(--bg)',
            color: state.is_participant ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${state.is_participant ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {state.is_participant ? <><Shield size={10} /> {t('tournament.player_badge')}</> : <><Eye size={10} /> {t('tournament.spectator_badge')}</>}
          </span>
        </div>

        {/* Join code */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          padding: '18px 24px', boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12,
          }}>
            {t('tournament.share_code')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800,
              letterSpacing: '0.2em', color: 'var(--accent)',
            }}>
              {state.join_code}
            </span>
            <button
              onClick={copyCode}
              style={{
                width: 38, height: 38, borderRadius: 11,
                border: '1px solid var(--border)', background: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
                color: copied ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            padding: '16px 18px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 9 }}>
              <Users size={13} color="var(--accent)" />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{t('tournament.players_label')}</span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
              {filled}<span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>/{max}</span>
            </p>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
              <motion.div
                animate={{ width: `${fillPct}%` }}
                transition={{ type: 'spring', stiffness: 120 }}
                style={{ height: '100%', background: 'var(--accent)', borderRadius: 99 }}
              />
            </div>
          </div>

          <div style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            padding: '16px 18px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 9 }}>
              <Clock size={13} color="var(--accent)" />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{t('tournament.time_limit_label')}</span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
              {state.time_limit}<span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>s</span>
            </p>
          </div>
        </div>

        {/* Player list */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          padding: '18px 20px', boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 14,
          }}>
            {t('tournament.players_label')} ({filled})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 210, overflowY: 'auto' }}>
            <AnimatePresence>
              {(state.participants || []).map((p, idx) => (
                <motion.div
                  key={p.id || p.username}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0' }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {avatar(p)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                    {displayName(p)}
                  </span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--success)', flexShrink: 0,
                  }} />
                </motion.div>
              ))}
            </AnimatePresence>
            {filled === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {t('tournament.no_players')}
              </p>
            )}
          </div>
        </div>

        {/* WS error */}
        <AnimatePresence>
          {wsError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{
                padding: '11px 14px', borderRadius: 12,
                background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
                color: 'var(--danger)', fontSize: 13,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}
            >
              <span style={{ marginTop: 1 }}>⚠</span>
              <span style={{ flex: 1 }}>{wsError}</span>
              <button
                onClick={onClearError}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 16 }}
              >✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        {state.is_teacher ? (
          <motion.button
            whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
            onClick={onStart}
            disabled={filled < 2}
            style={{
              width: '100%', padding: '15px 24px', borderRadius: 14, border: 'none',
              background: filled >= 2 ? 'var(--accent)' : 'var(--bg)',
              color: filled >= 2 ? '#fff' : 'var(--text-muted)',
              fontWeight: 800, fontSize: 15, cursor: filled < 2 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: filled >= 2 ? '0 8px 24px rgba(13,148,136,0.28)' : 'none',
              transition: 'all 0.2s',
              outline: filled < 2 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Swords size={18} />
            {filled < 2
              ? t('tournament.need_more', { count: 2 - filled })
              : t('tournament.start_btn')
            }
          </motion.button>
        ) : (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite',
              }} />
              {t('tournament.waiting_start')}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Tournament Home ───────────────────────────────────────────────────────────

function TournamentHome({ onCreated, onJoined }) {
  const { user }    = useAuth()
  const { t }       = useTranslation()
  const [tab, setTab]       = useState('create')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm]       = useState({ name: '', time_limit: 60, max_players: 8, text: '', text_difficulty: 'random' })
  const [joinCode, setJoinCode] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await createTournament(form)
      onCreated(data.join_code, data)
    } catch (err) {
      setError(err.response?.data?.detail || t('tournament.err_create'))
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await getTournament(joinCode.trim().toUpperCase())
      onJoined(data.join_code, data)
    } catch {
      setError(t('tournament.err_not_found_code'))
    } finally {
      setLoading(false)
    }
  }

  const DIFF_OPTIONS = [
    { v: 'random', label: t('tournament.diff_any')    },
    { v: 'easy',   label: t('tournament.diff_easy')   },
    { v: 'medium', label: t('tournament.diff_medium') },
    { v: 'hard',   label: t('tournament.diff_hard')   },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <motion.div
            animate={{ rotate: [0, -4, 4, -2, 2, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
            style={{
              display: 'inline-flex', width: 84, height: 84, borderRadius: 22,
              background: 'linear-gradient(135deg, var(--accent), #0891B2)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
              boxShadow: '0 16px 44px rgba(13,148,136,0.28)',
            }}
          >
            <Trophy size={38} color="#fff" />
          </motion.div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700,
            color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.01em',
          }}>
            {t('tournament.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>
            {t('tournament.subtitle')}
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { icon: '⚡', label: t('tournament.pill_realtime') },
              { icon: '🏆', label: t('tournament.pill_brackets') },
              { icon: '📊', label: t('tournament.pill_stats') },
            ].map(f => (
              <span key={f.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            background: 'var(--surface)', borderRadius: 22,
            border: '1px solid var(--border)', padding: '28px 28px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg)', borderRadius: 13,
            border: '1px solid var(--border)', padding: 4, marginBottom: 24,
          }}>
            {['create', 'join'].map(tabId => (
              <button key={tabId} onClick={() => setTab(tabId)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9,
                  border: 'none', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: tab === tabId ? 'var(--accent)' : 'transparent',
                  color: tab === tabId ? '#fff' : 'var(--text-muted)',
                  boxShadow: tab === tabId ? '0 4px 12px rgba(13,148,136,0.22)' : 'none',
                }}
              >
                {tabId === 'create' ? t('tournament.tab_create') : t('tournament.tab_join')}
              </button>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 18, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
                color: 'var(--danger)', fontSize: 13,
              }}
            >
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {tab === 'create' && (
              <motion.form key="create"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleCreate}
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                <div>
                  <label style={labelS}>{t('tournament.name_label')}</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required maxLength={120}
                    placeholder={t('tournament.name_placeholder')}
                    style={inputS}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelS}>{t('tournament.time_limit')}</label>
                    <select
                      value={form.time_limit}
                      onChange={e => setForm(f => ({ ...f, time_limit: +e.target.value }))}
                      style={inputS}
                    >
                      {[30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v}s</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelS}>{t('tournament.max_players')}</label>
                    <select
                      value={form.max_players}
                      onChange={e => setForm(f => ({ ...f, max_players: +e.target.value }))}
                      style={inputS}
                    >
                      {[4, 8, 16].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelS}>{t('tournament.difficulty')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
                    {DIFF_OPTIONS.map(({ v, label }) => (
                      <button
                        key={v} type="button"
                        onClick={() => setForm(f => ({ ...f, text_difficulty: v, text: '' }))}
                        style={{
                          padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `2px solid ${form.text_difficulty === v ? 'var(--accent)' : 'var(--border)'}`,
                          background: form.text_difficulty === v ? 'var(--accent-bg)' : 'transparent',
                          color: form.text_difficulty === v ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.text_difficulty === 'random' && (
                  <div>
                    <label style={labelS}>
                      {t('tournament.custom_text')}{' '}
                      <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>{t('tournament.optional')}</span>
                    </label>
                    <textarea
                      value={form.text}
                      onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                      rows={3} placeholder={t('tournament.custom_placeholder')}
                      style={{ ...inputS, resize: 'vertical', fontFamily: 'var(--font-body)' }}
                    />
                  </div>
                )}

                <motion.button
                  type="submit" disabled={loading}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 8px 24px rgba(13,148,136,0.28)', transition: 'all 0.2s',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                      {t('tournament.creating')}
                    </>
                  ) : (
                    <><Sparkles size={17} /> {t('tournament.create_btn')}</>
                  )}
                </motion.button>
              </motion.form>
            )}

            {tab === 'join' && (
              <motion.form key="join"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleJoin}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    {t('tournament.join_hint')}
                  </p>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    required maxLength={10}
                    placeholder={t('tournament.join_placeholder')}
                    style={{
                      width: '100%', padding: '16px 20px', borderRadius: 14,
                      border: '2px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                      fontSize: 28, fontWeight: 800, letterSpacing: '0.22em',
                      textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                  />
                </div>

                <motion.button
                  type="submit" disabled={loading}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 8px 24px rgba(13,148,136,0.28)', transition: 'all 0.2s',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                      {t('tournament.finding')}
                    </>
                  ) : (
                    <><Zap size={17} /> {t('tournament.find_btn')}</>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 12 }}>
      <div style={{ width: 40, height: 40, border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('tournament.connecting')}</p>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const labelS = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
}
const inputS = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 13, fontWeight: 500, outline: 'none',
  display: 'block', boxSizing: 'border-box', transition: 'border-color 0.2s',
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TournamentLobby() {
  const { joinCode: paramCode } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()

  const [phase,       setPhase]       = useState(paramCode ? 'joining' : 'home')
  const [joinCode,    setJoinCode]    = useState(paramCode || null)
  const [tournament,  setTournament]  = useState(null)
  const [lobbyState,  setLobbyState]  = useState(null)
  const [bracket,     setBracket]     = useState(null)
  const [error,       setError]       = useState('')
  const [wsError,     setWsError]     = useState('')
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    if (!paramCode) return
    getTournament(paramCode).then(r => {
      const trn = r.data
      setTournament(trn)
      if (trn.status === 'active' || trn.status === 'finished') { loadBracket(paramCode); return }
      if (trn.is_participant || trn.is_creator) setPhase('lobby')
    }).catch(() => setError(t('tournament.err_not_found')))
  }, [paramCode])

  const loadBracket = async (code) => {
    try {
      const { data } = await getBracket(code)
      setBracket(data)
      setPhase('bracket')
    } catch { setError(t('tournament.err_bracket')) }
  }

  useEffect(() => {
    if (phase !== 'bracket' || !joinCode || bracket?.status === 'finished') return
    const id = setInterval(() => {
      getBracket(joinCode).then(r => setBracket(r.data)).catch(() => {})
    }, 8000)
    return () => clearInterval(id)
  }, [phase, joinCode, bracket?.status])

  const wsPath = joinCode && phase === 'lobby' ? `/ws/tournament/lobby/${joinCode}/` : null
  const { send } = useWebSocket(wsPath, {
    onMessage: useCallback((msg) => {
      switch (msg.type) {
        case 'lobby_state': setLobbyState(msg); break
        case 'participant_joined':
          setLobbyState(prev => {
            if (!prev) return prev
            const already = prev.participants?.some(p => p.id === msg.user?.id)
            return { ...prev, participant_count: msg.count, participants: already ? prev.participants : [...(prev.participants || []), msg.user] }
          }); break
        case 'participant_left':
          setLobbyState(prev => prev
            ? { ...prev, participants: (prev.participants || []).filter(p => p.id !== msg.user_id), participant_count: Math.max(0, (prev.participant_count || 1) - 1) }
            : prev); break
        case 'tournament_started': setBracket(msg.bracket); setPhase('bracket'); break
        case 'text_updated':       setLobbyState(prev => prev ? { ...prev, text: msg.text } : prev); break
        case 'error':              setWsError(msg.message || 'Something went wrong'); break
        default: break
      }
    }, []),
    enabled: phase === 'lobby',
  })

  const handleStart = () => { setWsError(''); send({ type: 'start_tournament' }) }

  const handleCreated = (code, tournamentData) => {
    setJoinCode(code)
    setTournament(tournamentData)
    setPhase('joining')
    // navigate AFTER the user picks Play or Ghost — navigating here would
    // re-trigger the paramCode useEffect which overwrites phase → 'lobby'
  }

  const handleJoined = (code, tournamentData) => {
    setJoinCode(code); setTournament(tournamentData)
    if (tournamentData?.is_participant || tournamentData?.is_creator) setPhase('lobby')
    else setPhase('joining')
    navigate(`/tournament/${code}`, { replace: true })
  }

  const handlePlay = async () => {
    setRoleLoading(true)
    try { await joinTournament(joinCode) } catch {}
    setPhase('lobby')
    navigate(`/tournament/${joinCode}`, { replace: true })
    setRoleLoading(false)
  }

  const handleWatch      = () => { setPhase('lobby'); navigate(`/tournament/${joinCode}`, { replace: true }) }
  const handleMatchClick = (matchId) => navigate(`/tournament/match/${matchId}`)

  const handleWalkover = async (matchId, winnerId) => {
    try { const { data } = await walkoverMatch(matchId, winnerId); setBracket(data) }
    catch (err) { setError(err.response?.data?.detail || 'Walkover failed.') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <AnimatePresence mode="wait">

        {error ? (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', padding: 24 }}
          >
            <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
            <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 20, fontSize: 15 }}>{error}</p>
            <button
              onClick={() => { setError(''); setPhase('home'); setJoinCode(null); navigate('/tournament') }}
              style={{
                padding: '11px 26px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', boxShadow: '0 6px 18px rgba(13,148,136,0.25)',
              }}
            >
              {t('tournament.go_back')}
            </button>
          </motion.div>

        ) : phase === 'home' ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TournamentHome onCreated={handleCreated} onJoined={handleJoined} />
          </motion.div>

        ) : phase === 'joining' && tournament ? (
          <motion.div key="joining" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RoleSelect tournament={tournament} onPlay={handlePlay} onWatch={handleWatch} loading={roleLoading} />
          </motion.div>

        ) : phase === 'lobby' ? (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {lobbyState
              ? <LobbyRoom state={lobbyState} onStart={handleStart} wsError={wsError} onClearError={() => setWsError('')} />
              : <Spinner />
            }
          </motion.div>

        ) : phase === 'bracket' && bracket ? (
          <motion.div key="bracket" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 40px' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Trophy size={20} color="var(--accent)" />
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {bracket.name}
                  </h2>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {bracket.status === 'finished' ? t('tournament.tournament_complete') : t('tournament.tap_to_play')}
                </p>
              </div>
              <span style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                background: bracket.status === 'finished' ? 'rgba(5,150,105,0.1)' : 'var(--accent-bg)',
                color: bracket.status === 'finished' ? 'var(--success)' : 'var(--accent)',
                border: `1px solid ${bracket.status === 'finished' ? 'rgba(5,150,105,0.25)' : 'var(--accent)'}`,
              }}>
                {bracket.status}
              </span>
            </div>

            {/* Bracket card */}
            <div style={{
              background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)',
              padding: '24px', boxShadow: 'var(--shadow-md)',
            }}>
              <BracketView
                bracket={bracket} myUserId={user?.id}
                isTeacher={user?.role === 'teacher'}
                onMatchClick={handleMatchClick} onWalkover={handleWalkover}
              />
            </div>

            <Standings participants={bracket.participants || []} />
          </motion.div>

        ) : (
          <Spinner />
        )}

      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
