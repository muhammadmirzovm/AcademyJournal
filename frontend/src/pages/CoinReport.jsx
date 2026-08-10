import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Coins, Wallet, TrendingUp, TrendingDown, PiggyBank, Info, Receipt, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getCoinReport } from '../api/coins'
import { getAdminPurchases } from '../api/purchases'
import { useToast } from '../context/ToastContext'

const CATEGORY_COLORS = {
  snack:      '#0EA5E9',
  stationery: '#8B5CF6',
  merch:      '#F59E0B',
  discount:   '#16A34A',
  coupon:     '#DC2626',
  other:      '#64748B',
}

const STATUS_META = {
  active:  { color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  issued:  { color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
  expired: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

export default function CoinReport() {
  const { t }    = useTranslation()
  const { show } = useToast()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)

  const [purchases, setPurchases]         = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)

  const load = () => {
    setLoading(true)
    getCoinReport().then(r => setReport(r.data)).catch(() => show(t('coin_report.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    setPurchasesLoading(true)
    getAdminPurchases(page).then(r => {
      setPurchases(r.data.results)
      setPages(r.data.pages)
    }).catch(() => show(t('coin_report.toast_purchases_fail'), 'error')).finally(() => setPurchasesLoading(false))
  }, [page])

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

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Receipt size={16} color="var(--text-muted)" />
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('coin_report.purchase_history')}</p>
            </div>
            <PurchaseHistory
              purchases={purchases} loading={purchasesLoading}
              page={page} pages={pages} onPageChange={setPage} t={t}
            />
          </div>
        </>
      )}
    </div>
  )
}

function PurchaseHistory({ purchases, loading, page, pages, onPageChange, t }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (purchases.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('coin_report.no_purchases')}</p>
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {purchases.map(p => {
          const meta = STATUS_META[p.status] || STATUS_META.active
          const initials = (p.student_name?.[0] || p.student_username?.[0] || '?').toUpperCase()
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 120 }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{p.student_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {p.student_groups.length > 0 ? p.student_groups.join(', ') : t('coin_report.no_group')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
                {p.reward_image ? (
                  <img src={p.reward_image} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 16 }}>{p.reward_icon || '🎁'}</span>
                )}
                <span style={{ fontSize: 13 }}>{p.reward_name} {p.quantity > 1 && `×${p.quantity}`}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{p.total_price} 🪙</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{p.code}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: meta.color, background: meta.bg }}>
                {t(`scanner.status_${p.status}`)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {new Date(p.created_at).toLocaleDateString()}
              </span>
            </div>
          )
        })}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{page} / {pages}</span>
          <button onClick={() => onPageChange(p => Math.min(pages, p + 1))} disabled={page === pages}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
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
