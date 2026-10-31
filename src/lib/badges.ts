import { addDays, weekStart } from './dates'
import { streakLengths } from './streak'
import { levelFor, memberTickDates, partyXp, type GameData } from './xp'

export interface BadgeDef {
  id: string
  name: string
  hint: string
}

interface Ctx {
  data: GameData
  memberId: string
  memberIds: string[]
  extra: { cheersSent: number; bossesDefeated: number }
  dates: string[]
  longest: number
}

const LIST: (BadgeDef & { test: (c: Ctx) => boolean })[] = [
  { id: 'first-spark', name: 'First Spark', hint: 'Tick off your first routine.', test: (c) => c.dates.length > 0 },
  { id: 'first-sweat', name: 'First Sweat', hint: 'Log your first workout.', test: (c) => c.data.activities.some((a) => a.member_id === c.memberId) },
  { id: 'first-lesson', name: 'First Lesson', hint: 'Finish a study milestone.', test: (c) => c.data.milestones.some((m) => m.member_id === c.memberId && m.done) },
  { id: 'quiz-whiz', name: 'Quiz Whiz', hint: 'Answer 10 trivia questions correctly.', test: (c) => c.data.attempts.filter((a) => a.member_id === c.memberId && a.correct).length >= 10 },
  { id: 'streak-3', name: 'Three-Day Flame', hint: 'Tick something three days in a row.', test: (c) => c.longest >= 3 },
  { id: 'streak-7', name: 'Week of Fire', hint: 'Keep a seven-day streak.', test: (c) => c.longest >= 7 },
  { id: 'streak-30', name: 'Unbroken', hint: 'Keep a thirty-day streak.', test: (c) => c.longest >= 30 },
  {
    id: 'full-week',
    name: 'Full Week',
    hint: 'Tick something every day, Monday to Sunday.',
    test: (c) => {
      const have = new Set(c.dates)
      return c.dates.some((d) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i)).every((x) => have.has(x)))
    },
  },
  { id: 'first-bill', name: 'Debt Slayer I', hint: 'Record a bill payment.', test: (c) => c.data.payments.some((p) => p.member_id === c.memberId) },
  { id: 'payoff-hero', name: 'Payoff Hero', hint: 'Clear a one-time payoff.', test: (c) => c.data.bills.some((b) => b.kind === 'one_time' && b.paid) },
  { id: 'party-5', name: 'Party Level 5', hint: 'Reach party level 5 together.', test: (c) => levelFor(partyXp(c.data, c.memberIds)) >= 5 },
  { id: 'party-10', name: 'Party Level 10', hint: 'Reach party level 10 together.', test: (c) => levelFor(partyXp(c.data, c.memberIds)) >= 10 },
  { id: 'first-cheer', name: 'First Cheer', hint: 'Cheer on your partner.', test: (c) => c.extra.cheersSent >= 1 },
  { id: 'first-boss', name: 'Boss Slayer', hint: 'Defeat a weekly boss.', test: (c) => c.extra.bossesDefeated >= 1 },
]

export const BADGES: BadgeDef[] = LIST.map(({ id, name, hint }) => ({ id, name, hint }))

/** The ids of the badges this person has earned, in the order of `BADGES`. */
export function earnedBadges(data: GameData, memberId: string, memberIds: string[], extra: { cheersSent?: number; bossesDefeated?: number } = {}): string[] {
  const dates = memberTickDates(data, memberId)
  const ctx: Ctx = {
    data,
    memberId,
    memberIds,
    extra: { cheersSent: extra.cheersSent ?? 0, bossesDefeated: extra.bossesDefeated ?? 0 },
    dates,
    longest: Math.max(0, ...Object.values(streakLengths(dates))),
  }
  return LIST.filter((b) => b.test(ctx)).map((b) => b.id)
}
