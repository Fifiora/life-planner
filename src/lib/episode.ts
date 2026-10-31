import type { Expense } from '../types'
import { PLAN_START } from './dates'
import { shiftMonthKey } from './format'
import { monthActuals } from './ledger'
import { streakLengths } from './streak'
import { memberTicks, memberTickDates, type GameData } from './xp'

export const EPISODE_TITLES = ['The Fresh Start', 'The Savings Push', 'Rising Tide', 'Steady Footing', 'The Long Road', 'Bright Horizon']

const PLAN_MONTH = PLAN_START.slice(0, 7)
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1

/** `Arc 3: Rising Tide`: the month's place in the series. */
export function episodeTitle(month: string): string {
  const n = monthIndex(month) - monthIndex(PLAN_MONTH) + 1
  return `Arc ${n}: ${EPISODE_TITLES[(((n - 1) % EPISODE_TITLES.length) + EPISODE_TITLES.length) % EPISODE_TITLES.length]}`
}

export interface Episode {
  month: string
  title: string
  ticksByMember: Record<string, number>
  bestStreak: number
  billsPaid: number
  spent: number
}

/** A month told as an episode: a title in the series, what each of you ticked, streaks, bills paid and spending. */
export function episodeFor(month: string, data: GameData & { expenses: Expense[] }, members: { id: string }[]): Episode {
  const title = episodeTitle(month)
  const ticksByMember: Record<string, number> = {}
  let bestStreak = 0
  for (const m of members) {
    ticksByMember[m.id] = memberTicks(data, m.id).filter((t) => t.date.startsWith(month)).length
    for (const [date, len] of Object.entries(streakLengths(memberTickDates(data, m.id)))) if (date.startsWith(month)) bestStreak = Math.max(bestStreak, len)
  }
  return {
    month,
    title,
    ticksByMember,
    bestStreak,
    billsPaid: data.payments.filter((p) => p.month === month).length,
    spent: monthActuals(data.bills, data.payments, data.expenses, month).spent,
  }
}

/** The month to recap on Today: last month, during the first 7 days of a month (never before the plan began). */
export function episodeMonthFor(today: string): string | null {
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
