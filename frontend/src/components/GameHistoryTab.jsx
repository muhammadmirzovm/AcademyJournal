import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Loader2 } from 'lucide-react'
import { getGameHistory } from '../api/games'

const UZBEK_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

export default function GameHistoryTab({ groupId, t }) {
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
      {games.map((g, i) => <GameHistoryCard key={g.id} game={g} index={i} t={t} />)}
    </div>
  )
}

function GameHistoryCard({ game, index, t }) {
  const dayName = UZBEK_DAYS[new Date(game.date).getDay()]
  const totalCoins = game.results.reduce((sum, r) => sum + r.coins, 0)
  const placed = game.results.filter(r => r.place).sort((a, b) => a.place - b.place)
  const others = game.results.filter(r => !r.place && r.coins > 0)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      style={{ background: 'var(--surface)', border: `1px solid ${game.is_big_day ? 'rgba(0,142,0,0.25)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{dayName}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(game.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
          </span>
          {game.is_big_day && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,142,0,0.1)', color: '#008E00' }}>×2</span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{totalCoins} {t('game.coins_short')}</span>
      </div>

      {game.is_individual ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {game.results.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{r.student_name}</span>
              <span style={{ fontWeight: 700, color: r.coins > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {r.coins > 0 ? `+${r.coins}` : '0'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {placed.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: others.length ? 10 : 0 }}>
              {placed.map(r => (
                <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600 }}>
                  {r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : '🥉'} {r.student_name}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>+{r.coins}</span>
                </span>
              ))}
            </div>
          )}
          {others.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{others.map(r => r.student_name).join(', ')}</p>
          )}
        </>
      )}
    </motion.div>
  )
}
