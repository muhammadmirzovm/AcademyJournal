import { useTranslation } from 'react-i18next'

export default function LessonReportPreview({ preview }) {
  const { t } = useTranslation()
  if (!preview) return null
  const value = (field, item) => field === 'attendance'
    ? t(item === null ? 'lesson.report_unmarked' : item ? 'lesson.report_present' : 'lesson.report_absent')
    : item === null || item === '' ? '—' : String(item)
  const fields = changes => Object.entries(changes).map(([field, change]) => (
    <div key={field} style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      <strong>{t(`lesson.report_field_${field}`)}: </strong>
      <span style={{ color: 'var(--text-muted)' }}>{value(field, change.old)}</span>
      {' → '}<strong>{value(field, change.new)}</strong>
    </div>
  ))
  return <div style={{ maxHeight: '50vh', overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
    <p>{t('lesson.report_audience', { students: preview.student_count, parents: preview.parent_count })}</p>
    {Object.keys(preview.common_changes).length > 0 && <section style={{ marginTop: 12 }}>
      {fields(preview.common_changes)}
    </section>}
    <p style={{ fontWeight: 600, marginTop: 12 }}>{t('lesson.report_students')}</p>
    {preview.students.length === 0 ? <p>—</p> : preview.students.map(student => (
      <section key={student.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
        <strong>{student.name}</strong>
        {fields(student.changes)}
      </section>
    ))}
    {preview.parents.length > 0 && <p style={{ marginTop: 10 }}>
      <strong>{t('lesson.report_parents')}: </strong>{preview.parents.map(parent => parent.name).join(', ')}
    </p>}
    {preview.group_chat && <p style={{ marginTop: 10 }}>{t('lesson.report_group_chat')}</p>}
  </div>
}
