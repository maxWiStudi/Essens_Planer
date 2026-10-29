// Plan dates are local calendar days as 'YYYY-MM-DD' strings, never timestamps,
// so daylight saving and time zones cannot shift a meal to another day.

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(a, b) {
  // Whole days from a to b; noon avoids DST hour shifts.
  const da = fromISO(a), db = fromISO(b)
  da.setHours(12); db.setHours(12)
  return Math.round((db - da) / 86400000)
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(iso) {
  return (fromISO(iso).getDay() + 6) % 7
}

/** Start of the week containing iso. weekStart: 1 = Monday … 7 = Sunday. */
export function weekStartOf(iso, weekStart = 1) {
  const offset = (weekdayIndex(iso) - (weekStart - 1) + 7) % 7
  return addDays(iso, -offset)
}

export function today() {
  return toISO(new Date())
}

export function formatDay(iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return fromISO(iso).toLocaleDateString('de-DE', opts)
}

export function formatRange(startIso) {
  const f = (iso) => fromISO(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
  return `${f(startIso)} – ${f(addDays(startIso, 6))}`
}
