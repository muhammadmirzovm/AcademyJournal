// uz-UZ Intl month/weekday names render as "M06" in some engines — format
// explicitly against our own tables instead of relying on toLocaleDateString.

const MONTHS_LONG = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const MONTHS_SHORT = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// Sunday-first, matching Date#getDay()
const DAYS_LONG = {
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

const DAYS_SHORT = {
  uz: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

function lang3(lang) {
  if (lang?.startsWith('ru')) return 'ru'
  if (lang?.startsWith('en')) return 'en'
  return 'uz'
}

// "10-avgust, dushanba"
export function formatWeekdayDayMonth(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${d.getDate()}-${MONTHS_LONG[L][d.getMonth()]}, ${DAYS_LONG[L][d.getDay()]}`
}

// "10-avgust"
export function formatDayMonth(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${d.getDate()}-${MONTHS_LONG[L][d.getMonth()]}`
}

// "10-avgust, 2026"
export function formatDayMonthYear(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${d.getDate()}-${MONTHS_LONG[L][d.getMonth()]}, ${d.getFullYear()}`
}

// "10-avg"
export function formatShortDayMonth(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${d.getDate()}-${MONTHS_SHORT[L][d.getMonth()]}`
}

// "10-avg, 2026"
export function formatShortDayMonthYear(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${d.getDate()}-${MONTHS_SHORT[L][d.getMonth()]}, ${d.getFullYear()}`
}

// "Avgust 2026"
export function formatMonthYear(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${MONTHS_LONG[L][d.getMonth()]} ${d.getFullYear()}`
}

// "Avg 26"
export function formatShortMonthYear(value, lang) {
  const d = new Date(value)
  const L = lang3(lang)
  return `${MONTHS_SHORT[L][d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
}

export function weekdayName(dayIndex, lang) {
  return DAYS_LONG[lang3(lang)][dayIndex]
}

export function weekdayNameShort(dayIndex, lang) {
  return DAYS_SHORT[lang3(lang)][dayIndex]
}

export function formatDayMonthTime(value) {
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(value) {
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function timeAgo(value) {
  const diff = Math.floor((Date.now() - new Date(value)) / 1000)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}
