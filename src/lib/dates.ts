const TZ = 'America/Chicago'
const DAY_MS = 86_400_000

/** The day the shared plan begins (a Monday). The calendar has no end date and no limit either way. */
export const PLAN_START = '2026-10-26'

/** Default start (a Monday) of the 2-week cycle until Settings saves one. */
export const DEFAULT_ANCHOR = '2026-11-02'

const ymdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date (YYYY-MM-DD) in Chicago time. */
export function todayCT(now: Date = new Date()): string {
  return ymdFormat.format(now)
}

/** Current month (YYYY-MM) in Chicago time. */
export function monthKeyCT(now: Date = new Date()): string {
  return todayCT(now).slice(0, 7)
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: string, n: number): string {
  return new Date(toUtcMs(date) + n * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}

/** The Monday that starts the week containing `date`. */
export function weekStart(date: string): string {
  const dow = new Date(toUtcMs(date)).getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

/** First day of the month `n` months away from `date`'s month. */
export function shiftMonths(date: string, n: number): string {
  const [y, m] = date.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}
