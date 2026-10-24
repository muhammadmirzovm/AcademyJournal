import DOMPurify from 'dompurify'

const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'ul', 'ol', 'li']

export function homeworkHtml(value = '', format = 'plain') {
  if (format === 'html') return DOMPurify.sanitize(value, { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: ['start'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false })
  const escaped = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
  return escaped ? `<p>${escaped.replaceAll('\n', '<br>')}</p>` : '<p></p>'
}
