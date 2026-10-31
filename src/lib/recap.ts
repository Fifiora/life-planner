import type { RoutineLog } from '../types'
import { addDays } from './dates'

/** What each person ticked off in the last 7 days (today included); a routine counts once per person per day. */
export function weekRecap(logs: RoutineLog[], today: string): { total: number; byMember: Record<string, number> } {
  const start = addDays(today, -6)
  const seen = new Set<string>()
  const byMember: Record<string, number> = {}
  let total = 0
  for (const l of logs) {
    if (!l.done || l.date < start || l.date > today) continue
    const key = `${l.member_id}|${l.routine_id}|${l.date}`
    if (seen.has(key)) continue
    seen.add(key)
    byMember[l.member_id] = (byMember[l.member_id] ?? 0) + 1
    total++
  }
  return { total, byMember }
}
