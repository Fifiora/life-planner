import type { Activity, Routine, RoutineLog } from '../types'
import { meetsTimeRule } from './cadence'
import { addDays } from './dates'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** How a timed routine (bedtime, wake-up) went over the last `days` days. */
export function timeStats(logs: RoutineLog[], routine: Routine, today: string, days: number, memberId?: string) {
  const start = addDays(today, -(days - 1))
  const mine = logs.filter(
    (l) => l.routine_id === routine.id && l.value && l.date >= start && l.date <= today && (!memberId || l.member_id === memberId),
  )
  if (mine.length === 0) return { logged: 0, onTime: 0, avg: null as string | null }
  const bedtime = routine.time_rule?.startsWith('before') ?? false
  const minutes = mine.map((l) => {
    const m = toMinutes(l.value as string)
    return bedtime && m < 12 * 60 ? m + 24 * 60 : m // after midnight counts as very late, not very early
  })
  const avg = Math.round(minutes.reduce((s, n) => s + n, 0) / minutes.length) % (24 * 60)
  return {
    logged: mine.length,
    onTime: mine.filter((l) => meetsTimeRule(routine.time_rule, l.value as string)).length,
    avg: `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`,
  }
}

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

/** Ticks this month versus how many were expected by today. */
export function scorecard(routine: Routine, logs: RoutineLog[], today: string) {
  const month = today.slice(0, 7)
  const day = Number(today.slice(8, 10))
  const dates = new Set(
    logs.filter((l) => l.routine_id === routine.id && l.done && l.date.startsWith(month) && l.date <= today).map((l) => l.date),
  )
  const times = routine.times_per_period || 1
  let expected: number
  switch (routine.cadence) {
    case 'daily':
      expected = day
      break
    case 'weekly':
      if (routine.weekday != null) {
        expected = 0
        for (let d = 1; d <= day; d++) if (dayOfWeek(`${month}-${String(d).padStart(2, '0')}`) === routine.weekday) expected++
      } else {
        expected = Math.ceil(day / 7) * times
      }
      break
    case 'biweekly':
      expected = Math.ceil(day / 14) * times
      break
    default:
      expected = times
  }
  return { count: dates.size, expected, pct: expected > 0 ? Math.min(100, Math.round((dates.size / expected) * 100)) : 0 }
}

/** Active days, minutes and kinds of activity over the last 7 days. */
export function activityWeek(activities: Activity[], today: string, memberId?: string) {
  const start = addDays(today, -6)
  const week = activities.filter((a) => a.date >= start && a.date <= today && (!memberId || a.member_id === memberId))
  const byType: Record<string, number> = {}
  for (const a of week) byType[a.type] = (byType[a.type] ?? 0) + 1
  return {
    activeDays: new Set(week.map((a) => a.date)).size,
    minutes: week.reduce((s, a) => s + (a.minutes ?? 0), 0),
    byType,
  }
}
