import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, BookOpen, Loader2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import {
  getTopics, createTopic, deleteTopic,
  getQuestions, createQuestion, updateQuestion, deleteQuestion,
  getQuestionBanks,
} from '../api/quiz'

const DIFF_COLOR = { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' }
const DIFF_BG    = { easy: 'rgba(34,197,94,0.1)', medium: 'rgba(245,158,11,0.1)', hard: 'rgba(239,68,68,0.1)' }
const TYPE_LABEL = { mcq: 'A/B/C/D', true_false: 'T/F', open: 'Open' }
const PAGE_SIZE  = 12

export default function QuestionBank() {
  const { show } = useToast()
  const { t } = useTranslation()
  const { user } = useAuth()

  const [banks,     setBanks]     = useState([])
  const [selBank,   setSelBank]   = useState(null)
  const [topics,    setTopics]    = useState([])
  const [questions, setQuestions] = useState([])
  const [selTopic,  setSelTopic]  = useState(null)
  const [selDiff,   setSelDiff]   = useState('')
  const [loading,   setLoading]   = useState(true)

  const [page,         setPage]         = useState(1)
  const [showQModal,   setShowQModal]   = useState(false)
  const [editingQ,     setEditingQ]     = useState(null)
  const [newTopicName, setNewTopicName] = useState('')
  const [addingTopic,  setAddingTopic]  = useState(false)

  useEffect(() => {
    getQuestionBanks().then(res => setBanks(res.data)).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [tRes, qRes] = await Promise.all([
        getTopics(selBank ? { owner: selBank } : undefined),
        getQuestions({ owner: selBank || undefined, topic: selTopic || undefined, difficulty: selDiff || undefined }),
      ])
      setTopics(tRes.data)
      setQuestions(qRes.data)
    } catch { show(t('quiz.toast_load_fail'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { setPage(1); setSelTopic(null); load() }, [selBank])
  useEffect(() => { setPage(1); load() }, [selTopic, selDiff])

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return
    try {
      const { data } = await createTopic({ name: newTopicName.trim() })
      setTopics(ts => [...ts, data])
      setNewTopicName('')
      setAddingTopic(false)
    } catch { show(t('quiz.toast_topic_fail'), 'error') }
  }

  const handleDeleteTopic = async (id) => {
    try {
      await deleteTopic(id)
      setTopics(ts => ts.filter(t => t.id !== id))
      if (selTopic === id) setSelTopic(null)
    } catch { show(t('quiz.toast_topic_delete_fail'), 'error') }
  }

  const handleSaveQuestion = async (form) => {
    try {
      if (editingQ) {
        const { data } = await updateQuestion(editingQ.id, form)
        setQuestions(qs => qs.map(q => q.id === data.id ? data : q))
        show(t('quiz.toast_q_updated'), 'success')
      } else {
        const { data } = await createQuestion(form)
        setQuestions(qs => [data, ...qs])
        show(t('quiz.toast_q_added'), 'success')
      }
      setShowQModal(false)
      setEditingQ(null)
    } catch { show(t('quiz.toast_q_fail'), 'error') }
  }

  const handleDeleteQuestion = async (id) => {
    try {
      await deleteQuestion(id)
      setQuestions(qs => qs.filter(q => q.id !== id))
      show(t('quiz.toast_q_deleted'), 'info')
    } catch { show(t('quiz.toast_q_fail'), 'error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'calc(100vh - 100px)' }}>

      {/* Bank filter */}
      {banks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bank:</span>
          <button onClick={() => setSelBank(null)}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${!selBank ? 'var(--accent)' : 'var(--border)'}`, background: !selBank ? 'var(--accent-bg)' : 'transparent', color: !selBank ? 'var(--accent)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            All
          </button>
          {banks.map(b => (
            <button key={b.id} onClick={() => setSelBank(b.id)}
              style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${selBank === b.id ? 'var(--accent)' : 'var(--border)'}`, background: selBank === b.id ? 'var(--accent-bg)' : 'transparent', color: selBank === b.id ? 'var(--accent)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {b.name}{b.is_me ? ' (you)' : ''}
              <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{b.question_count}</span>
            </button>
          ))}
        </div>
      )}

    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      {/* Topic sidebar */}
      <div style={{ width: 220, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'sticky', top: 80 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{t('quiz.topics')}</p>

        <button onClick={() => setSelTopic(null)}
          style={{ ...topicBtn, background: !selTopic ? 'var(--accent-bg)' : 'transparent', color: !selTopic ? 'var(--accent)' : 'var(--text)' }}>
          <BookOpen size={13} /> {t('quiz.all_topics')}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{questions.length}</span>
        </button>

        {topics.map(tp => (
          <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setSelTopic(tp.id)}
              style={{ ...topicBtn, flex: 1, background: selTopic === tp.id ? 'var(--accent-bg)' : 'transparent', color: selTopic === tp.id ? 'var(--accent)' : 'var(--text)' }}>
              {tp.name}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{tp.question_count}</span>
            </button>
            {tp.created_by_id === user?.id && (
              <button onClick={() => handleDeleteTopic(tp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}

        {addingTopic ? (
          <div style={{ marginTop: 8 }}>
            <input autoFocus value={newTopicName} onChange={e => setNewTopicName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') setAddingTopic(false) }}
              placeholder={t('quiz.topic_name_placeholder')}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button onClick={handleAddTopic} style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Check size={11} /> {t('quiz.add')}
              </button>
              <button onClick={() => setAddingTopic(false)} style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                <X size={11} />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingTopic(true)}
            style={{ ...topicBtn, color: 'var(--accent)', marginTop: 6, border: '1px dashed var(--accent)', borderRadius: 6 }}>
            <Plus size={12} /> {t('quiz.new_topic')}
          </button>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{t('quiz.question_bank')}</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Difficulty filter */}
            <select value={selDiff} onChange={e => setSelDiff(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              <option value="">{t('quiz.all_difficulties')}</option>
              <option value="easy">{t('quiz.easy')}</option>
              <option value="medium">{t('quiz.medium')}</option>
              <option value="hard">{t('quiz.hard')}</option>
            </select>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingQ(null); setShowQModal(true) }}
              style={primaryBtn}>
              <Plus size={14} /> {t('quiz.new_question')}
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader2 size={28} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : questions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: '64px 24px', color: 'var(--text-muted)' }}>
            <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{t('quiz.no_questions')}</p>
            <p style={{ fontSize: 13 }}>{t('quiz.no_questions_sub')}</p>
          </div>
        ) : (() => {
          const pageCount = Math.ceil(questions.length / PAGE_SIZE)
          const safePage  = Math.min(page, pageCount)
          const pageQs    = questions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
          const from      = (safePage - 1) * PAGE_SIZE + 1
          const to        = Math.min(safePage * PAGE_SIZE, questions.length)

          const pages = []
          for (let p = 1; p <= pageCount; p++) {
            if (pageCount <= 7 || p === 1 || p === pageCount || Math.abs(p - safePage) <= 1) {
              pages.push(p)
            } else if (pages[pages.length - 1] !== '…') {
              pages.push('…')
            }
          }

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                <AnimatePresence>
                  {pageQs.map((q, i) => (
                    <QuestionCard key={q.id} q={q} index={i} userId={user?.id}
                      onEdit={() => { setEditingQ(q); setShowQModal(true) }}
                      onDelete={() => handleDeleteQuestion(q.id)} />
                  ))}
                </AnimatePresence>
              </div>

              {pageCount > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, flexWrap: 'wrap', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('quiz.showing_results', { from, to, total: questions.length })}
                  </span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      style={{ ...pageBtn, opacity: safePage === 1 ? 0.35 : 1 }}>
                      <ChevronLeft size={15} />
                    </button>
                    {pages.map((p, i) =>
                      p === '…'
                        ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 13 }}>…</span>
                        : <button key={p} onClick={() => setPage(p)}
                            style={{ ...pageBtn, minWidth: 34, fontWeight: p === safePage ? 700 : 500, background: p === safePage ? 'var(--accent)' : 'var(--surface)', color: p === safePage ? '#fff' : 'var(--text)', borderColor: p === safePage ? 'var(--accent)' : 'var(--border)' }}>
                            {p}
                          </button>
                    )}
                    <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}
                      style={{ ...pageBtn, opacity: safePage === pageCount ? 0.35 : 1 }}>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>

      <QuestionModal open={showQModal} onClose={() => { setShowQModal(false); setEditingQ(null) }}
        editing={editingQ} topics={topics.filter(tp => tp.created_by_id === user?.id)} onSave={handleSaveQuestion} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </div>
  )
}

function QuestionCard({ q, index, userId, onEdit, onDelete }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const isOwn = q.created_by_id === userId
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLOR[q.difficulty], background: DIFF_BG[q.difficulty], borderRadius: 99, padding: '2px 8px' }}>
          {t(`quiz.${q.difficulty}`)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 99, padding: '2px 8px' }}>
          {q.topic_name}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 8px' }}>
          {TYPE_LABEL[q.answer_type]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', borderRadius: 99, padding: '2px 8px', marginLeft: 'auto' }}>
          {q.points} {t('quiz.pts')}
        </span>
      </div>

      {/* Question text */}
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>
        {q.text.length > 120 ? q.text.slice(0, 120) + '…' : q.text}
      </p>

      {/* Footer: owner + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
          {isOwn ? 'You' : q.created_by_name}
        </span>
        {isOwn && (
          confirm ? (
            <>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('quiz.delete')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('quiz.cancel')}</button>
            </>
          ) : (
            <>
              <button onClick={onEdit} style={iconBtn}><Pencil size={13} color="var(--text-muted)" /></button>
              <button onClick={() => setConfirm(true)} style={iconBtn}><Trash2 size={13} color="var(--text-muted)" /></button>
            </>
          )
        )}
      </div>
    </motion.div>
  )
}

function QuestionModal({ open, onClose, editing, topics, onSave }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const blank = { topic: '', text: '', hint: '', answer_type: 'mcq', points: 1, difficulty: 'easy', options: { a: '', b: '', c: '', d: '' }, correct_answer: 'a' }
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setForm({
        topic: editing.topic,
        text: editing.text,
        hint: editing.hint || '',
        answer_type: editing.answer_type,
        points: editing.points,
        difficulty: editing.difficulty,
        options: editing.options || { a: '', b: '', c: '', d: '' },
        correct_answer: editing.correct_answer || 'a',
      })
    } else {
      setForm(blank)
    }
    setError('')
  }, [editing, open])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setOpt = (key, val) => setForm(f => ({ ...f, options: { ...f.options, [key]: val } }))

  const submit = async e => {
    e.preventDefault()
    if (!form.topic) { setError(t('quiz.err_topic')); return }
    if (!form.text.trim()) { setError(t('quiz.err_text')); return }
    if (form.answer_type === 'mcq') {
      const opts = form.options || {}
      if (!opts.a || !opts.b) { setError(t('quiz.err_options')); return }
    }
    setLoading(true)
    const payload = {
      topic: form.topic,
      text: form.text.trim(),
      hint: form.hint.trim(),
      answer_type: form.answer_type,
      points: Number(form.points) || 1,
      difficulty: form.difficulty,
      options: form.answer_type === 'mcq' ? form.options : null,
      correct_answer: form.correct_answer,
    }
    try { await onSave(payload) } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('quiz.edit_question') : t('quiz.new_question')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Topic */}
        <div>
          <label style={labelStyle}>{t('quiz.topic')}</label>
          <select value={form.topic} onChange={e => { set('topic', e.target.value); setError('') }}
            style={{ ...inputStyle(false), marginTop: 5 }}>
            <option value="">{t('quiz.select_topic')}</option>
            {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select>
        </div>

        {/* Question text */}
        <div>
          <label style={labelStyle}>{t('quiz.question_text')}</label>
          <textarea value={form.text} onChange={e => { set('text', e.target.value); setError('') }}
            rows={3} placeholder={t('quiz.question_placeholder')}
            style={{ ...inputStyle(false), marginTop: 5, resize: 'vertical', fontFamily: 'var(--font-body)' }} />
        </div>

        {/* Hint */}
        <div>
          <label style={labelStyle}>{t('quiz.hint')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>({t('quiz.optional')})</span></label>
          <input value={form.hint} onChange={e => set('hint', e.target.value)}
            placeholder={t('quiz.hint_placeholder')}
            style={{ ...inputStyle(false), marginTop: 5 }} />
        </div>

        {/* Points + Difficulty row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('quiz.points')}</label>
            <input type="number" min={1} max={100} value={form.points} onChange={e => set('points', e.target.value)}
              style={{ ...inputStyle(false), marginTop: 5 }} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>{t('quiz.difficulty')}</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
              {['easy', 'medium', 'hard'].map(d => (
                <button key={d} type="button" onClick={() => set('difficulty', d)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${form.difficulty === d ? DIFF_COLOR[d] : 'var(--border)'}`, background: form.difficulty === d ? DIFF_BG[d] : 'transparent', color: form.difficulty === d ? DIFF_COLOR[d] : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {t(`quiz.${d}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Answer type */}
        <div>
          <label style={labelStyle}>{t('quiz.answer_type')}</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
            {[['mcq', 'A/B/C/D'], ['true_false', 'True / False'], ['open', t('quiz.open')]].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => set('answer_type', val)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: `1.5px solid ${form.answer_type === val ? 'var(--accent)' : 'var(--border)'}`, background: form.answer_type === val ? 'var(--accent-bg)' : 'transparent', color: form.answer_type === val ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* MCQ options */}
        {form.answer_type === 'mcq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>{t('quiz.options')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>({t('quiz.mark_correct')})</span></label>
            {['a', 'b', 'c', 'd'].map(letter => (
              <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" name="correct" value={letter} checked={form.correct_answer === letter}
                  onChange={() => set('correct_answer', letter)} style={{ accentColor: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', width: 14 }}>{letter.toUpperCase()}</span>
                <input value={form.options?.[letter] || ''} onChange={e => setOpt(letter, e.target.value)}
                  placeholder={`${t('quiz.option')} ${letter.toUpperCase()}`}
                  style={{ ...inputStyle(false), flex: 1 }} />
              </div>
            ))}
          </div>
        )}

        {/* True/False */}
        {form.answer_type === 'true_false' && (
          <div>
            <label style={labelStyle}>{t('quiz.correct_answer')}</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
              {['true', 'false'].map(v => (
                <button key={v} type="button" onClick={() => set('correct_answer', v)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: `1.5px solid ${form.correct_answer === v ? 'var(--accent)' : 'var(--border)'}`, background: form.correct_answer === v ? 'var(--accent-bg)' : 'transparent', color: form.correct_answer === v ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {v === 'true' ? t('quiz.true') : t('quiz.false')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Open answer */}
        {form.answer_type === 'open' && (
          <div>
            <label style={labelStyle}>{t('quiz.correct_answer')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>({t('quiz.optional')})</span></label>
            <input value={form.correct_answer} onChange={e => set('correct_answer', e.target.value)}
              placeholder={t('quiz.answer_placeholder')}
              style={{ ...inputStyle(false), marginTop: 5 }} />
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: -6 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('quiz.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
            style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('quiz.saving') : t('quiz.save')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

const topicBtn   = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'left', marginBottom: 2, background: 'transparent' }
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }
const dangerBtn  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 6 }
const pageBtn    = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', minWidth: 32, height: 32 }
const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const inputStyle = (err) => ({ width: '100%', padding: '8px 11px', borderRadius: 7, border: `1.5px solid ${err ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', display: 'block', boxSizing: 'border-box' })
