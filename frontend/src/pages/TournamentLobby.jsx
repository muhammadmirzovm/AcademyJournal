import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, Users, Clock, Copy, Check, Swords, Crown,
  ArrowRight, Eye, Play, Zap, Shield, ChevronRight, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { createTournament, joinTournament, getBracket, getTournament, walkoverMatch } from '../api/tournament'

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const avatar = (p) => (p?.first_name?.[0] || p?.username?.[0] || '?').toUpperCase()
const displayName = (p) => p?.first_name || p?.username || 'Unknown'

// ─── shared input/label styles ────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400 transition-all text-base'
const labelCls = 'block text-xs font-bold text-white/50 uppercase tracking-widest mb-2'

// ─── Bracket ──────────────────────────────────────────────────────────────────

function MatchCard({ match, myUserId, isTeacher, onMatchClick, onWalkover }) {
  const p1     = match.player1
  const p2     = match.player2
  const isMyMatch = (p1?.user_id === myUserId || p2?.user_id === myUserId) &&
                    match.status !== 'finished' && match.status !== 'bye'
  const isDone = match.status === 'finished' || match.status === 'bye'
  const canSkip = isTeacher && !isDone
  const [loading, setLoading] = useState(false)

  const handleSkip = async (e, winnerId) => {
    e.stopPropagation()
    setLoading(true)
    try { await onWalkover(match.id, winnerId) }
    finally { setLoading(false) }
  }

  return (
    <motion.div
      whileHover={isMyMatch ? { scale: 1.03, y: -2 } : {}}
      onClick={() => isMyMatch && onMatchClick(match.id)}
      className={`rounded-2xl overflow-hidden transition-all duration-200 w-52 border ${
        isMyMatch
          ? 'border-violet-400/60 shadow-xl shadow-violet-500/25 cursor-pointer bg-gradient-to-b from-violet-900/60 to-indigo-900/60'
          : isDone
          ? 'border-white/5 bg-white/3 opacity-50'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {isMyMatch && (
        <div className="bg-violet-500 px-3 py-2 text-center">
          <span className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
            ▶ Your Match
          </span>
        </div>
      )}

      {[p1, p2].map((p, i) => (
        <div key={i}
          className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? 'border-b border-white/8' : ''} ${
            isDone && match.winner?.user_id === p?.user_id ? 'bg-amber-500/10' : ''
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
            isDone && match.winner?.user_id === p?.user_id
              ? 'bg-amber-400 text-gray-900'
              : p ? 'bg-white/10 text-white' : 'bg-white/5 text-white/20'
          }`}>
            {isDone && match.winner?.user_id === p?.user_id ? '🏆' : (p ? avatar(p) : '?')}
          </div>
          <span className={`text-sm font-semibold truncate flex-1 ${
            isDone && match.winner?.user_id === p?.user_id
              ? 'text-amber-300'
              : p ? 'text-white/90' : 'text-white/25 italic'
          }`}>
            {p ? displayName(p) : 'TBD'}
          </span>
          {canSkip && p && (
            <button
              onClick={(e) => handleSkip(e, p.user_id)}
              disabled={loading}
              title={`${displayName(p)} wins`}
              className="w-7 h-7 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 flex items-center justify-center text-sm transition-colors flex-shrink-0"
            >✓</button>
          )}
        </div>
      ))}

      {canSkip && (
        <div className="px-4 py-2 text-center border-t border-white/5">
          <span className="text-xs text-white/30">✓ to set winner</span>
        </div>
      )}
    </motion.div>
  )
}

function BracketView({ bracket, myUserId, isTeacher, onMatchClick, onWalkover }) {
  if (!bracket?.rounds?.length) return null
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max pt-1 px-1">
        {bracket.rounds.map((round) => (
          <div key={round.id} className="flex flex-col items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${
              round.status === 'active'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : round.status === 'finished'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/5 text-white/30 border border-white/8'
            }`}>
              {round.round_name}
            </div>
            <div className="flex flex-col gap-4 justify-around flex-1">
              {round.matches.map((match) => (
                <MatchCard key={match.id} match={match} myUserId={myUserId}
                  isTeacher={isTeacher} onMatchClick={onMatchClick} onWalkover={onWalkover} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Standings / Podium ───────────────────────────────────────────────────────

const MEDAL = ['🥇', '🥈', '🥉']

function Standings({ participants }) {
  const sorted = [...participants]
    .filter(p => p.final_position != null)
    .sort((a, b) => a.final_position - b.final_position)
  const active = participants.filter(p => p.final_position == null)

  if (sorted.length === 0 && active.length === 0) return null

  const nm = p => p.first_name || p.username || '?'
  const ini = p => nm(p)[0].toUpperCase()

  const podium        = sorted.slice(0, 3)
  const rest          = sorted.slice(3)
  // reorder: 2nd | 1st | 3rd
  const podiumDisplay = podium.length >= 2
    ? [podium[1], podium[0], podium[2]].filter(Boolean)
    : podium

  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-14' }
  const colors  = {
    1: 'from-amber-400 to-yellow-500',
    2: 'from-slate-300 to-slate-400',
    3: 'from-orange-400 to-amber-600',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-10">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={18} className="text-amber-400" />
        <h3 className="text-base font-black text-white">
          {sorted.some(p => p.final_position === 1) ? 'Final Standings' : 'Live Standings'}
        </h3>
      </div>

      {podiumDisplay.length > 0 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {podiumDisplay.map((p) => {
            const pos = p.final_position
            const h   = heights[pos] || 'h-12'
            const cl  = colors[pos]  || 'from-gray-500 to-gray-600'
            return (
              <motion.div key={p.user_id}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * pos, type: 'spring', stiffness: 220, damping: 20 }}
                className="flex flex-col items-center gap-2 w-28"
              >
                <div className="relative">
                  {pos === 1 && (
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl select-none">👑</motion.div>
                  )}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cl} flex items-center justify-center text-xl font-black text-white shadow-xl`}>
                    {ini(p)}
                  </div>
                </div>
                <p className="text-xs font-bold text-white text-center truncate w-full px-1">{nm(p)}</p>
                {p.best_wpm > 0 && (
                  <p className="text-[11px] font-bold text-violet-300">{Math.round(p.best_wpm)} wpm</p>
                )}
                <div className={`w-full ${h} bg-gradient-to-br ${cl} rounded-t-2xl flex items-center justify-center shadow-lg`}>
                  <span className="text-2xl">{MEDAL[pos - 1] || pos}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {(rest.length > 0 || active.length > 0) && (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/3">
          {rest.map((p) => (
            <div key={p.user_id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0">
              <span className="w-7 text-center text-sm font-black text-white/40">{p.final_position}</span>
              <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-xs font-bold text-white/70">
                {ini(p)}
              </div>
              <span className="flex-1 text-sm font-semibold text-white/80 truncate">{nm(p)}</span>
              {p.best_wpm > 0 && <span className="text-xs font-bold text-violet-400">{Math.round(p.best_wpm)} <span className="font-normal text-white/30">wpm</span></span>}
              {p.best_accuracy > 0 && <span className="text-xs font-bold text-emerald-400">{Math.round(p.best_accuracy)}%</span>}
            </div>
          ))}
          {active.length > 0 && (
            <>
              {rest.length > 0 && (
                <div className="px-5 py-2 bg-white/3 border-b border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/25">Still playing</span>
                </div>
              )}
              {active.map(p => (
                <div key={p.user_id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0">
                  <span className="w-7 flex justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                    {ini(p)}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-white/80 truncate">{nm(p)}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Role Selection ───────────────────────────────────────────────────────────

function RoleSelect({ tournament, onPlay, onWatch, loading }) {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-5"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
              <Trophy size={42} className="text-white" />
            </div>
          </motion.div>
          <h2 className="text-3xl font-black text-white mb-2">{tournament.name}</h2>
          <p className="text-white/50 text-sm">{tournament.participant_count} / {tournament.max_players} players · {tournament.time_limit}s per round</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onPlay} disabled={loading || tournament.is_full}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Play size={24} className="text-white" fill="white" />
            </div>
            <div className="text-center">
              <p className="font-black text-white text-sm">Join as Player</p>
              <p className="text-[11px] text-white/40 mt-0.5">{tournament.is_full ? 'Room full' : 'Compete & win'}</p>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onWatch}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Eye size={24} className="text-white/60" />
            </div>
            <div className="text-center">
              <p className="font-black text-white text-sm">Watch</p>
              <p className="text-[11px] text-white/40 mt-0.5">Spectate only</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Lobby Room ───────────────────────────────────────────────────────────────

function LobbyRoom({ state, onStart, wsError, onClearError }) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(state.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filled = state.participant_count || 0
  const max    = state.max_players || 8

  return (
    <div className="flex items-start justify-center min-h-[70vh] px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4">

        {/* Header */}
        <div className="text-center mb-8">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-xl shadow-amber-400/30">
              <Trophy size={28} className="text-white" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-black text-white">{state.name}</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
              state.is_participant
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25'
                : 'bg-white/8 text-white/50 border border-white/10'
            }`}>
              {state.is_participant ? <><Shield size={10} /> Player</> : <><Eye size={10} /> Spectator</>}
            </span>
          </div>
        </div>

        {/* Join code */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-black text-white/35 uppercase tracking-widest text-center mb-4">Share this code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-mono font-black tracking-[0.25em] text-violet-300">{state.join_code}</span>
            <button onClick={copyCode}
              className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/50" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Users size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-white/40 uppercase tracking-wide">Players</span>
            </div>
            <p className="text-2xl font-black text-white">{filled}<span className="text-base font-medium text-white/30">/{max}</span></p>
            <div className="mt-2 h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div className="h-full bg-violet-500 rounded-full"
                animate={{ width: `${(filled / max) * 100}%` }} transition={{ type: 'spring' }} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Clock size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-white/40 uppercase tracking-wide">Time limit</span>
            </div>
            <p className="text-2xl font-black text-white">{state.time_limit}<span className="text-base font-medium text-white/30">s</span></p>
          </div>
        </div>

        {/* Participants */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-black text-white/35 uppercase tracking-widest mb-4">Players ({filled})</p>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            <AnimatePresence>
              {(state.participants || []).map((p, idx) => (
                <motion.div key={p.id || p.username}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {avatar(p)}
                  </div>
                  <span className="text-sm font-semibold text-white/80">{displayName(p)}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto flex-shrink-0" />
                </motion.div>
              ))}
            </AnimatePresence>
            {filled === 0 && <p className="text-sm text-white/30 text-center py-3">No players yet…</p>}
          </div>
        </div>

        {/* WS error */}
        <AnimatePresence>
          {wsError && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span className="flex-1">{wsError}</span>
              <button onClick={onClearError} className="text-red-400/60 hover:text-red-400">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        {state.is_teacher ? (
          <motion.button whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
            onClick={onStart} disabled={filled < 2}
            className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2 text-base"
          >
            <Swords size={20} />
            {filled < 2 ? `Need ${2 - filled} more player${filled === 1 ? '' : 's'}` : 'Start Tournament'}
          </motion.button>
        ) : (
          <div className="text-center py-3">
            <span className="inline-flex items-center gap-2 text-sm text-white/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Waiting for host to start…
            </span>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Create / Join Form ───────────────────────────────────────────────────────

function TournamentHome({ onCreated, onJoined }) {
  const { user }    = useAuth()
  const isTeacher   = user?.role === 'teacher'
  const [tab, setTab] = useState(isTeacher ? 'create' : 'join')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({ name: '', time_limit: 60, max_players: 8, text: '', text_difficulty: 'random' })
  const [joinCode, setJoinCode] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await createTournament(form)
      onCreated(data.join_code)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create tournament')
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
      setError('Tournament not found. Check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <div className="w-full max-w-lg">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-10">
          <motion.div
            animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
            className="inline-flex w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 items-center justify-center mb-6 shadow-2xl shadow-amber-500/30"
          >
            <Trophy size={44} className="text-white" />
          </motion.div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Typing Tournament</h1>
          <p className="text-white/45 text-sm">Real-time 1v1 typing speed battles</p>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 shadow-2xl"
        >
          {/* Tabs */}
          {isTeacher && (
            <div className="flex rounded-2xl bg-black/20 border border-white/8 p-1 mb-6">
              {['create', 'join'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 rounded-xl text-sm font-black transition-all capitalize ${
                    tab === t
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg'
                      : 'text-white/40 hover:text-white/70'
                  }`}>
                  {t === 'create' ? '✦ Create' : '→ Join'}
                </button>
              ))}
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {tab === 'create' && isTeacher && (
              <motion.form key="create"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreate} className="space-y-4"
              >
                <div>
                  <label className={labelCls}>Tournament Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required maxLength={120} className={inputCls} placeholder="Spring Championship 2025" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Time limit</label>
                    <select value={form.time_limit} onChange={e => setForm(f => ({ ...f, time_limit: +e.target.value }))}
                      className={inputCls}>
                      {[30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v}s</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Max players</label>
                    <select value={form.max_players} onChange={e => setForm(f => ({ ...f, max_players: +e.target.value }))}
                      className={inputCls}>
                      {[4, 8, 16].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Difficulty</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: 'random', label: 'Any',    cl: 'border-white/15 text-white/50 data-[active=true]:border-white/40 data-[active=true]:text-white data-[active=true]:bg-white/8' },
                      { v: 'easy',   label: 'Easy',   cl: 'border-emerald-500/30 text-emerald-500/50 data-[active=true]:border-emerald-400 data-[active=true]:text-emerald-300 data-[active=true]:bg-emerald-500/10' },
                      { v: 'medium', label: 'Medium', cl: 'border-amber-500/30 text-amber-500/50 data-[active=true]:border-amber-400 data-[active=true]:text-amber-300 data-[active=true]:bg-amber-500/10' },
                      { v: 'hard',   label: 'Hard',   cl: 'border-red-500/30 text-red-500/50 data-[active=true]:border-red-400 data-[active=true]:text-red-300 data-[active=true]:bg-red-500/10' },
                    ].map(({ v, label, cl }) => (
                      <button type="button" key={v}
                        data-active={form.text_difficulty === v}
                        onClick={() => setForm(f => ({ ...f, text_difficulty: v, text: '' }))}
                        className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${cl}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.text_difficulty === 'random' && (
                  <div>
                    <label className={labelCls}>Custom text <span className="normal-case font-normal opacity-60">(optional)</span></label>
                    <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                      rows={3} className={`${inputCls} resize-none`} placeholder="The quick brown fox…" />
                  </div>
                )}

                <motion.button type="submit" disabled={loading}
                  whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                  className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2 text-base"
                >
                  {loading
                    ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</span>
                    : <><Sparkles size={18} /> Create Tournament</>
                  }
                </motion.button>
              </motion.form>
            )}

            {tab === 'join' && (
              <motion.form key="join"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleJoin} className="space-y-5"
              >
                <div className="text-center py-4">
                  <p className="text-white/40 text-sm mb-4">Enter the tournament code shared by your teacher</p>
                  <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    required maxLength={10}
                    className="w-full px-6 py-5 rounded-2xl bg-white/5 border-2 border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-400 font-mono text-3xl tracking-[0.3em] text-center transition-all"
                    placeholder="TRN-XXXX" />
                </div>
                <motion.button type="submit" disabled={loading}
                  whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                  className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2 text-base"
                >
                  {loading
                    ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Finding…</span>
                    : <><Zap size={18} /> Find Tournament</>
                  }
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentLobby() {
  const { joinCode: paramCode } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

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
      const t = r.data
      setTournament(t)
      if (t.status === 'active' || t.status === 'finished') {
        loadBracket(paramCode); return
      }
      if (t.is_participant || t.is_creator) setPhase('lobby')
    }).catch(() => setError('Tournament not found.'))
  }, [paramCode])

  const loadBracket = async (code) => {
    try {
      const { data } = await getBracket(code)
      setBracket(data)
      setPhase('bracket')
    } catch { setError('Could not load bracket.') }
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
        case 'lobby_state':       setLobbyState(msg); break
        case 'participant_joined':
          setLobbyState(prev => {
            if (!prev) return prev
            const already = prev.participants?.some(p => p.id === msg.user?.id)
            return { ...prev, participant_count: msg.count, participants: already ? prev.participants : [...(prev.participants || []), msg.user] }
          }); break
        case 'participant_left':
          setLobbyState(prev => prev ? { ...prev, participants: (prev.participants||[]).filter(p=>p.id!==msg.user_id), participant_count: Math.max(0,(prev.participant_count||1)-1) } : prev); break
        case 'tournament_started': setBracket(msg.bracket); setPhase('bracket'); break
        case 'text_updated':       setLobbyState(prev => prev ? { ...prev, text: msg.text } : prev); break
        case 'error':              setWsError(msg.message || 'Something went wrong'); break
        default: break
      }
    }, []),
    enabled: phase === 'lobby',
  })

  const handleStart = () => { setWsError(''); send({ type: 'start_tournament' }) }

  const handleCreated = (code) => { setJoinCode(code); setPhase('lobby'); navigate(`/tournament/${code}`, { replace: true }) }

  const handleJoined = (code, tournamentData) => {
    setJoinCode(code); setTournament(tournamentData)
    if (tournamentData?.is_participant || tournamentData?.is_creator) setPhase('lobby')
    else setPhase('joining')
    navigate(`/tournament/${code}`, { replace: true })
  }

  const handlePlay = async () => {
    setRoleLoading(true)
    try { await joinTournament(joinCode) } catch {}
    setPhase('lobby'); setRoleLoading(false)
  }

  const handleWatch = () => setPhase('lobby')
  const handleMatchClick = (matchId) => navigate(`/tournament/match/${matchId}`)

  const handleWalkover = async (matchId, winnerId) => {
    try { const { data } = await walkoverMatch(matchId, winnerId); setBracket(data) }
    catch (err) { setError(err.response?.data?.detail || 'Walkover failed.') }
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #0a0b14 0%, #0d0e1a 60%, #0e0b1f 100%)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">

          {error ? (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-screen text-center px-4">
              <p className="text-red-400 font-semibold mb-4">{error}</p>
              <button onClick={() => { setError(''); setPhase('home'); setJoinCode(null); navigate('/tournament') }}
                className="px-6 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors">
                Go back
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
                : (
                  <div className="flex flex-col items-center justify-center min-h-screen gap-3">
                    <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-white/30">Connecting…</p>
                  </div>
                )}
            </motion.div>

          ) : phase === 'bracket' && bracket ? (
            <motion.div key="bracket" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="max-w-6xl mx-auto px-6 py-10"
            >
              {/* Bracket header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
                    <Trophy size={22} className="text-amber-400" />
                    {bracket.name}
                  </h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {bracket.status === 'finished' ? '🏆 Tournament complete!' : 'Tap your highlighted match to play'}
                  </p>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                  bracket.status === 'finished'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                }`}>
                  {bracket.status}
                </span>
              </div>

              {/* Bracket */}
              <div className="rounded-3xl border border-white/10 bg-white/3 backdrop-blur-sm p-8 shadow-2xl">
                <BracketView
                  bracket={bracket}
                  myUserId={user?.id}
                  isTeacher={user?.role === 'teacher'}
                  onMatchClick={handleMatchClick}
                  onWalkover={handleWalkover}
                />
              </div>

              <Standings participants={bracket.participants || []} />
            </motion.div>

          ) : (
            <div className="flex items-center justify-center min-h-screen">
              <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
