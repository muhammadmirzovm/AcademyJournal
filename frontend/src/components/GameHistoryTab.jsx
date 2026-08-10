import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Trophy, Loader2, Coins } from 'lucide-react'
import { getGameHistory } from '../api/games'
import { weekdayName, formatDayMonth } from '../utils/date'

const effortLabel = (effort, t) => effort === 2 ? t('game.effort_good') : effort === 1 ? t('game.effort_ok') : t('game.effort_none')

export default function GameHistoryTab({ groupId, t }) {
  const { i18n } = useTranslation()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getGameHistory(groupId).then(r => setGames(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [groupId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={24} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ width: 48, height: 48, background: 'var(--accent-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Trophy size={22} color="var(--accent)" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('game.history_empty')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {games.map((g, i) => <GameHistoryCard key={g.id} game={g} index={i} t={t} lang={i18n.language} />)}
    </div>
  )
}

function GameHistoryCard({ game, index, t, lang }) {
  const dayName = weekdayName(new Date(game.date).getDay(), lang)
  const totalCoins = game.results.reduce((sum, r) => sum + r.coins, 0)
  // Placed students first (by place), then the rest by coins earned, descending.
  const sortedResults = [...game.results].sort((a, b) => {
    if (a.place && b.place) return a.place - b.place
    if (a.place) return -1
    if (b.place) return 1
    return b.coins - a.coins
  })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      style={{ background: 'var(--surface)', border: `1px solid ${game.is_big_day ? 'rgba(0,142,0,0.25)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{dayName}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatDayMonth(game.date, lang)}
          </span>
          {game.is_big_day && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,142,0,0.1)', color: '#008E00' }}>×2</span>
          )}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
          <Coins size={13} color="var(--accent)" fill="var(--accent)" /> {totalCoins}
        </span>
      </div>

      {game.is_individual ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {game.results.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span>{r.student_name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: r.coins > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                <Coins size={12} color={r.coins > 0 ? 'var(--success)' : 'var(--text-muted)'} fill={r.coins > 0 ? 'var(--success)' : 'none'} />
                {r.coins > 0 ? `+${r.coins}` : '0'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedResults.map(r => {
            const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : null
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ width: 18, flexShrink: 0, textAlign: 'center' }}>
                  {medal || <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>●</span>}
                </span>
                <span style={{ flex: 1, fontWeight: medal ? 600 : 400 }}>{r.student_name}</span>
                {!medal && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{effortLabel(r.effort, t)}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, flexShrink: 0, color: r.coins > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                  <Coins size={12} color={r.coins > 0 ? 'var(--success)' : 'var(--text-muted)'} fill={r.coins > 0 ? 'var(--success)' : 'none'} />
                  {r.coins > 0 ? `+${r.coins}` : '0'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
