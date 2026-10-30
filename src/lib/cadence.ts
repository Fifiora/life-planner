import type { Cadence, Routine, RoutineLog } from '../types'
import { addDays, daysBetween, shiftMonths, weekStart } from './dates'

/** Identifies the period (day, week, 2-week block, month, quarter) a date falls in. */
export function periodKey(cadence: Cadence, date: string, anchor: string): string {
  switch (cadence) {
    case 'daily':
      return date
    case 'weekly':
      return weekStart(date)
    case 'biweekly':
      return `bw-${Math.floor(daysBetween(anchor, date) / 14)}`
    case 'monthly':
      return date.slice(0, 7)
    case 'quarterly': {
      const [y, m] = date.split('-').map(Number)
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
    }
  }
}

function previousPeriodDate(cadence: Cadence, date: string): string {
  switch (cadence) {
    case 'daily':
      return addDays(date, -1)
    case 'weekly':
      return addDays(date, -7)
    case 'biweekly':
      return addDays(date, -14)
    case 'monthly':
      return shiftMonths(date, -1)
    case 'quarterly':
      return shiftMonths(date, -3)
  }
}

export function periodProgress(
  routine: Routine,
  logs: RoutineLog[],
  date: string,
  anchor: string,
): { count: number; target: number; done: boolean } {
  const key = periodKey(routine.cadence, date, anchor)
  const days = new Set<string>()
  for (const l of logs) {
    if (l.routine_id === routine.id && l.done && periodKey(routine.cadence, l.date, anchor) === key) {
      days.add(l.date)
    }
  }
  const target = routine.times_per_period
  return { count: days.size, target, done: days.size >= target }
}

/** Consecutive completed periods ending now; an unfinished current period does not break it. */
export function streak(routine: Routine, logs: RoutineLog[], today: string, anchor: string): number {
  const met = (d: string) => periodProgress(routine, logs, d, anchor).done
  let cursor = today
  if (!met(cursor)) cursor = previousPeriodDate(routine.cadence, cursor)
  let n = 0
  while (n < 3650 && met(cursor)) {
    n++
    cursor = previousPeriodDate(routine.cadence, cursor)
  }
  return n
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Rules look like 'before 22:30' or 'after 04:00'.
 * A 'before' rule treats morning-hour values (00:00-11:59) as past midnight, i.e. a miss.
 */
export function meetsTimeRule(rule: string | null, hhmm: string): boolean {
  if (!rule) return true
  const match = /^(before|after)\s+(\d{1,2}:\d{2})$/.exec(rule.trim())
  if (!match) return true
  const limit = minutes(match[2])
  const value = minutes(hhmm)
  if (match[1] === 'before') {
    if (value < 12 * 60) return false
    return value <= limit
  }
  return value >= limit
}
