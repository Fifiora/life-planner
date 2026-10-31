import { addDays, daysBetween, weekStart } from './dates'

interface Step {
  date: string
  len: number
  /** Monday-based weeks whose one empty day has been forgiven inside this run. */
  rested: Set<string>
}

/** Walk the ticked days (oldest first); one empty day per week is bridged without adding to the count. */
function walk(dates: string[]): Step[] {
  const sorted = [...new Set(dates)].sort()
  const steps: Step[] = []
  let prev: Step | null = null
  for (const date of sorted) {
    let step: Step
    if (!prev) step = { date, len: 1, rested: new Set() }
    else {
      const gap = daysBetween(prev.date, date)
      const missed = weekStart(addDays(prev.date, 1))
      if (gap === 1) step = { date, len: prev.len + 1, rested: prev.rested }
      else if (gap === 2 && !prev.rested.has(missed)) step = { date, len: prev.len + 1, rested: new Set([...prev.rested, missed]) }
      else step = { date, len: 1, rested: new Set() }
    }
    steps.push(step)
    prev = step
  }
  return steps
}

/** For every ticked day, how long the streak was on that day. */
export function streakLengths(dates: string[]): Record<string, number> {
  return Object.fromEntries(walk(dates).map((s) => [s.date, s.len]))
}

/** The streak as of `today`: it stays alive while today is still open, or after one forgiven empty day. */
export function dayStreak(dates: string[], today: string): { days: number; restUsed: boolean } {
  const steps = walk(dates.filter((d) => d <= today))
  const last = steps[steps.length - 1]
  if (!last) return { days: 0, restUsed: false }
  const gap = daysBetween(last.date, today)
  const alive = gap <= 1 || (gap === 2 && !last.rested.has(weekStart(addDays(last.date, 1))))
  return alive ? { days: last.len, restUsed: last.rested.size > 0 } : { days: 0, restUsed: false }
}
