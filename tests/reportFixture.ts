import type { ReportInput } from '../src/lib/reportTypes'
import type { Routine, RoutineLog } from '../src/types'

export const members = [
  { id: 'a', display_name: 'Ada' },
  { id: 'b', display_name: 'Ben' },
]

/** An empty but valid input: two people, no rows, today is 2026-11-03 (so October is a finished month). */
export function reportInput(over: Partial<ReportInput> = {}): ReportInput {
  return {
    members,
    routines: [],
    logs: [],
    activities: [],
    milestones: [],
    attempts: [],
    trips: [],
    places: [],
    nights: [],
    events: [],
    expenses: [],
    bills: [],
    payments: [],
    budgets: [],
    savings: [],
    incomeConfigured: 0,
    savingsTarget: 10000,
    today: '2026-11-03',
    ...over,
  }
}

export const routine = (id: string, over: Partial<Routine> = {}): Routine => ({
  id,
  name: id,
  bucket: 'health',
  cadence: 'daily',
  times_per_period: 1,
  applies_to: 'both',
  place: null,
  time_rule: null,
  weekday: null,
  active: true,
  shared: false,
  ...over,
})

export const tick = (id: string, routine_id: string, member_id: string, date: string, value: string | null = null): RoutineLog => ({ id, routine_id, member_id, date, done: true, value })

/** `n` consecutive dates starting at `from` (YYYY-MM-DD). */
export const run = (from: string, n: number): string[] => Array.from({ length: n }, (_, i) => new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10) + i)).toISOString().slice(0, 10))
