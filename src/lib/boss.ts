import { addDays, daysBetween, PLAN_START, shiftMonths, weekStart } from './dates'
import { memberTicks, type GameData } from './xp'

export interface Boss {
  id: 'wraith' | 'giant' | 'sphinx' | 'twins'
  name: string
  blurb: string
  target: number
  unit: string
}

export const BOSSES: Boss[] = [
  { id: 'wraith', name: 'Lord Snooze', blurb: 'He feeds on skipped routines. Tick together to beat him.', target: 60, unit: 'ticks' },
  { id: 'giant', name: 'The Couch Colossus', blurb: 'Get moving! Every logged workout shakes him.', target: 8, unit: 'workouts' },
  { id: 'sphinx', name: 'The Book Sphinx', blurb: 'Finish study milestones to answer her riddles.', target: 6, unit: 'milestones' },
  { id: 'twins', name: 'The Together Twins', blurb: 'Both of you tick something on the same day.', target: 5, unit: 'days together' },
]

/** The boss on for the week starting `week` (a Monday). They rotate from the plan start. */
export function bossForWeek(week: string): Boss {
  const n = Math.floor(daysBetween(weekStart(PLAN_START), week) / 7)
  return BOSSES[((n % BOSSES.length) + BOSSES.length) % BOSSES.length]
}

/** How much damage the two of you have done to `boss` in the week starting `week`. */
export function bossProgress(
  boss: Boss,
  week: string,
  data: GameData,
  memberIds: string[],
  ticksOf: (memberId: string) => { date: string }[] = (id) => memberTicks(data, id),
): { value: number; target: number; defeated: boolean } {
  const last = addDays(week, 6)
  const inWeek = (date: string) => date >= week && date <= last
  let value = 0
  if (boss.id === 'wraith') value = memberIds.reduce((s, id) => s + ticksOf(id).filter((t) => inWeek(t.date)).length, 0)
  else if (boss.id === 'giant') value = data.activities.filter((a) => memberIds.includes(a.member_id) && inWeek(a.date)).length
  else if (boss.id === 'sphinx') value = data.milestones.filter((m) => memberIds.includes(m.member_id) && m.week_start === week && m.done).length
  else {
    const days = memberIds.map((id) => new Set(ticksOf(id).filter((t) => inWeek(t.date)).map((t) => t.date)))
    if (days.length >= 2) value = [...days[0]].filter((d) => days.every((s) => s.has(d))).length
  }
  return { value, target: boss.target, defeated: value >= boss.target }
}

/** Bosses beaten in weeks that start inside `month` (a `YYYY-MM` key). */
export function bossesBeatenIn(month: string, data: GameData, memberIds: string[]): number {
  const first = `${month}-01`
  const last = addDays(shiftMonths(first, 1), -1)
  let n = 0
  for (let w = weekStart(first) === first ? first : addDays(weekStart(first), 7); w <= last; w = addDays(w, 7)) {
    if (bossProgress(bossForWeek(w), w, data, memberIds).defeated) n++
  }
  return n
}
