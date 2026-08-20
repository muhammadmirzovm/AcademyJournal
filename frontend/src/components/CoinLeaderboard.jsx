import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { getCoinLeaderboard } from '../api/coins'

const MEDALS = [
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', height: 78 },
  { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', height: 58 },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', height: 48 },
]
const MEDAL_EMOJI = ['🥇', '🥈', '🥉']

export default function CoinLeaderboard() {
  const { t } = useTranslation()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCoinLeaderboard().then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 32, height: 180 }} />
    )
  }
  if (rows.length === 0) return null

  const top = rows.slice(0, 3)
  const rest = rows.slice(3, 10)
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top
  const medalFor = s => top.indexOf(s)

  return (
    <div className="fade-up-2" style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 20, marginBottom: 32, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Coins size={16} color="#F59E0B" />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>{t('dashboard.coin_leaderboard')}</h3>
      </div>

      {top.length === 3 && (
        <div className="podium-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          {order.map((s, i) => {
            const rank  = medalFor(s)
            const medal = MEDALS[rank]
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, maxWidth: 140 }}>
                <Link to={`/profile/${s.id}`} style={{ textDecoration: 'none', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: medal.bg, border: `2px solid ${medal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontSize: 20 }}>
                    {MEDAL_EMOJI[rank]}
                  </div>
                  <p className="podium-name" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{s.display_name}</p>
                  <p style={{ fontSize: 12, color: medal.color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <Coins size={11} /> {s.balance}
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
            return (
              <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: rank < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {rank + 1}
                </span>
                <Link to={`/profile/${s.id}`} style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.display_name}
                </Link>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Coins size={12} /> {s.balance}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
