import type { Activity, Bill, BillPayment, Bucket, Milestone, Routine, RoutineLog, TriviaAttempt } from '../types'
import { streakLengths } from './streak'

/** Everything XP is worked out from: rows that already sync between the phones. */
export interface GameData {
  routines: Routine[]
  logs: RoutineLog[]
  activities: Activity[]
  milestones: Milestone[]
  attempts: TriviaAttempt[]
  payments: BillPayment[]
  bills: Bill[]
}

export type BucketXp = Record<Bucket, number>
export const BUCKETS: Bucket[] = ['health', 'study', 'travel', 'food', 'finance']

export const xpForLevel = (n: number): number => 50 * n * (n - 1)

export function levelFor(xp: number): number {
  let n = 1
  while (xpForLevel(n + 1) <= xp) n++
  return n
}

export function levelProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelFor(xp)
  return { level, into: xp - xpForLevel(level), needed: xpForLevel(level + 1) - xpForLevel(level) }
}

/** One person's ticks that still belong to a routine, once per routine per day, in log order. */
function validTicks(data: GameData, memberId: string): { date: string; bucket: Bucket }[] {
  const byId = new Map(data.routines.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const out: { date: string; bucket: Bucket }[] = []
  for (const l of data.logs) {
    if (!l.done || l.member_id !== memberId) continue
    const routine = byId.get(l.routine_id)
    if (!routine) continue
    const key = `${l.routine_id}|${l.date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ date: l.date, bucket: routine.bucket })
  }
  return out
}

/** The days this person ticked something. */
export const memberTickDates = (data: GameData, memberId: string): string[] => [...new Set(validTicks(data, memberId).map((t) => t.date))]

export function memberXp(data: GameData, memberId: string): { total: number; byBucket: BucketXp } {
  const byBucket: BucketXp = { health: 0, study: 0, travel: 0, food: 0, finance: 0 }

  const ticks = validTicks(data, memberId)
  const lengths = streakLengths(ticks.map((t) => t.date))
  const bonusGiven = new Set<string>()
  for (const t of ticks) {
    byBucket[t.bucket] += 10
    if (!bonusGiven.has(t.date)) {
      bonusGiven.add(t.date)
      byBucket[t.bucket] += Math.min(20, 2 * lengths[t.date])
    }
  }

  const activityIds = new Set<string>()
  for (const a of data.activities) {
    if (a.member_id !== memberId || activityIds.has(a.id)) continue
    activityIds.add(a.id)
    byBucket.health += 15 + Math.min(15, Math.floor((a.minutes ?? 0) / 10))
  }

  for (const m of data.milestones) if (m.member_id === memberId && m.done) byBucket.study += 15

  const answered = new Set<string>()
  for (const a of data.attempts) {
    if (a.member_id !== memberId || answered.has(a.question_id)) continue
    answered.add(a.question_id)
    byBucket.study += a.correct ? 8 : 3
  }

  for (const p of data.payments) if (p.member_id === memberId) byBucket.finance += 20

  return { total: BUCKETS.reduce((s, b) => s + byBucket[b], 0), byBucket }
}

export const partyXp = (data: GameData, memberIds: string[]): number => memberIds.reduce((s, id) => s + memberXp(data, id).total, 0)
