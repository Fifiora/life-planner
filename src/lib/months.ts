import { PLAN_START } from './dates'
import { shiftMonthKey } from './format'

const PLAN_MONTH = PLAN_START.slice(0, 7)

/** The month to point at on Today: last month, during the first 7 days of a month (never before the plan began). */
export function reportMonthFor(today: string): string | null {
  if (Number(today.slice(8, 10)) > 7) return null
  const prev = shiftMonthKey(today.slice(0, 7), -1)
  return prev >= PLAN_MONTH ? prev : null
}

/** Finished months since the plan began, newest first. */
export function finishedMonths(today: string): string[] {
  const out: string[] = []
  for (let m = shiftMonthKey(today.slice(0, 7), -1); m >= PLAN_MONTH; m = shiftMonthKey(m, -1)) out.push(m)
  return out
}
