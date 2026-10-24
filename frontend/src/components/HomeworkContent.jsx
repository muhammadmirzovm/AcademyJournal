import { homeworkHtml } from '../utils/homework'

export default function HomeworkContent({ value = '', format = 'plain' }) {
  if (!value) return <div className="homework-rich-text">—</div>
  if (format !== 'html') return <div className="homework-rich-text homework-plain-text">{value || '—'}</div>
  return <div className="homework-rich-text" dangerouslySetInnerHTML={{ __html: homeworkHtml(value, format) }} />
}
