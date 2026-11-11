import type { Activity, Bill, BillPayment, Bucket, Milestone, Routine, RoutineLog, TriviaAttempt } from '../types'
import { streakLengths } from './streak'

/** Everything XP is worked out from: rows that already sync between the phones. */
export interface TickData {
  routines: Routine[]
  logs: RoutineLog[]
  activities: Activity[]
  milestones: Milestone[]
  attempts: TriviaAttempt[]
  payments: BillPayment[]
  bills: Bill[]
}

export const BUCKETS: Bucket[] = ['health', 'study', 'travel', 'food', 'finance']

export function memberTicks(data: TickData, memberId: string): { date: string; bucket: Bucket; routine: string }[] {
  const byId = new Map(data.routines.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const out: { date: string; bucket: Bucket; routine: string }[] = []
  for (const l of data.logs) {
    if (!l.done || l.member_id !== memberId) continue
    const routine = byId.get(l.routine_id)
    if (!routine) continue
    const key = `${l.routine_id}|${l.date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ date: l.date, bucket: routine.bucket, routine: routine.id })
  }
  return out
}

/** The days this person ticked something. */
export const memberTickDates = (data: TickData, memberId: string): string[] => [...new Set(memberTicks(data, memberId).map((t) => t.date))]

