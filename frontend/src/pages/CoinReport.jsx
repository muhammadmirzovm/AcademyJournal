import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Coins, Wallet, TrendingUp, TrendingDown, PiggyBank, Info } from 'lucide-react'
import { getCoinReport } from '../api/coins'
import { useToast } from '../context/ToastContext'

const CATEGORY_COLORS = {
  snack:      '#0EA5E9',
  stationery: '#8B5CF6',
  merch:      '#F59E0B',
  discount:   '#16A34A',
  coupon:     '#DC2626',
  other:      '#64748B',
}

export default function CoinReport() {
  const { t }    = useTranslation()
  const { show } = useToast()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getCoinReport().then(r => setReport(r.data)).catch(() => show(t('coin_report.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const som = n => new Intl.NumberFormat('uz-UZ').format(n)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('coin_report.title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('coin_report.subtitle')}</p>
      </div>

      {loading || !report ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 84, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : (
        <>
          {report.coin_value_som === 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13 }}>
              <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('coin_report.no_value_hint')}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26 }}>
            <StatCard icon={Wallet} label={t('coin_report.outstanding_balance')} value={`${som(report.outstanding_balance)} 🪙`} color="var(--accent)" />
            <StatCard icon={PiggyBank} label={t('coin_report.estimated_liability')} value={`${som(report.estimated_liability_som)} so'm`} color="#F59E0B" />
            <StatCard icon={TrendingUp} label={t('coin_report.issued_30d')} value={`${som(report.issued_last_30_days)} 🪙`} color="#16A34A" />
            <StatCard icon={TrendingDown} label={t('coin_report.spent_30d')} value={`${som(report.spent_last_30_days)} 🪙`} color="#DC2626" />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Coins size={16} color="var(--text-muted)" />
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('coin_report.spend_by_category')}</p>
            </div>

            {report.spend_by_category.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('coin_report.no_purchases')}</p>
            ) : (
              <SpendByCategory rows={report.spend_by_category} t={t} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SpendByCategory({ rows, t }) {
  const total = rows.reduce((sum, r) => sum + r.coins, 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => {
        const pct = Math.round((r.coins / total) * 100)
        const color = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.other
        return (
          <div key={r.category}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t(`rewards.cat_${r.category}`)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {r.coins} 🪙 · {r.purchase_count} {t('coin_report.purchases_suffix')} · {pct}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg)', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                style={{ height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}
