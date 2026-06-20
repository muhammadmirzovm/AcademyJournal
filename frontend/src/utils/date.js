// uz-UZ Intl month names render as "M06" in some engines — format explicitly instead.
export function formatDayMonthTime(value) {
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
