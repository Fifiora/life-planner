import { describe, it, expect } from 'vitest'
import { BADGES, earnedBadges } from '../src/lib/badges'
import type { GameData } from '../src/lib/xp'
import type { Routine } from '../src/types'
import { addDays } from '../src/lib/dates'

const routine: Routine = { id: 'r1', name: 'r1', bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true }
const empty = (): GameData => ({ routines: [routine], logs: [], activities: [], milestones: [], attempts: [], payments: [], bills: [] })
const ticks = (dates: string[], member = 'a') => dates.map((date, i) => ({ id: `t${member}${i}`, routine_id: 'r1', member_id: member, date, done: true, value: null }))
const run = (d: GameData, extra?: { cheersSent?: number; bossesDefeated?: number }) => earnedBadges(d, 'a', ['a', 'b'], extra)
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

describe('badges', () => {
  it('has unique ids and a hint for each', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
    BADGES.forEach((b) => expect(b.hint.length).toBeGreaterThan(0))
  })
  it('earns nothing from an empty planner', () => {
    expect(run(empty())).toEqual([])
  })
  it('First Spark for the first tick', () => {
    expect(run({ ...empty(), logs: ticks(['2026-11-04']) })).toContain('first-spark')
  })
  it('First Sweat for the first activity', () => {
    expect(run({ ...empty(), activities: [{ id: 'x', date: '2026-11-04', member_id: 'a', type: 'run', minutes: 20 }] })).toContain('first-sweat')
  })
  it('First Lesson for the first finished milestone', () => {
    expect(run({ ...empty(), milestones: [{ id: 'm', week_start: '2026-11-02', member_id: 'a', text: 't', done: true }] })).toContain('first-lesson')
  })
  it('Quiz Whiz at 10 correct answers', () => {
    const at = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, question_id: `q${i}`, member_id: 'a', chosen_index: 0, correct: true }))
    expect(run({ ...empty(), attempts: at(9) })).not.toContain('quiz-whiz')
    expect(run({ ...empty(), attempts: at(10) })).toContain('quiz-whiz')
    const twice = [...at(5), ...at(5).map((a) => ({ ...a, id: `again${a.id}` }))]
    expect(run({ ...empty(), attempts: twice })).not.toContain('quiz-whiz') // replaying the same 5 questions is not 10 answers
  })
  it('streak badges at 3, 7 and 30 days', () => {
    expect(run({ ...empty(), logs: ticks(days('2026-11-01', 3)) })).toContain('streak-3')
    expect(run({ ...empty(), logs: ticks(days('2026-11-01', 3)) })).not.toContain('streak-7')
    expect(run({ ...empty(), logs: ticks(days('2026-11-01', 7)) })).toContain('streak-7')
    expect(run({ ...empty(), logs: ticks(days('2026-10-01', 30)) })).toContain('streak-30')
  })
  it('Full Week for a tick on every day of a Monday-to-Sunday week', () => {
    expect(run({ ...empty(), logs: ticks(days('2026-10-26', 7)) })).toContain('full-week')
    expect(run({ ...empty(), logs: ticks(days('2026-10-27', 7)) })).not.toContain('full-week')
  })
  it('bill badges', () => {
    const pay = { id: 'p', bill_id: 'b1', month: '2026-11', paid_on: '2026-11-03', member_id: 'a' }
    const base = { ...empty(), payments: [pay] } as GameData
    expect(run(base)).toContain('first-bill')
    expect(run(base)).not.toContain('payoff-hero')
    const bill = { id: 'b1', name: 'Card payoff', amount: 2200, category: 'debt', kind: 'one_time', due_month: '2026-11', paid: true }
    expect(run({ ...base, bills: [bill] } as GameData)).toContain('payoff-hero')
  })
  it('party level badges', () => {
    const lots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `act${i}`, date: '2026-11-04', member_id: 'a', type: 'run', minutes: 0 }))
    // 15 XP each: 67 -> 1005 XP is level 5 (needs 1000); 3 more levels of XP needed for 10 (4500 XP -> 300 activities)
    expect(run({ ...empty(), activities: lots(67) })).toContain('party-5')
    expect(run({ ...empty(), activities: lots(66) })).not.toContain('party-5')
    expect(run({ ...empty(), activities: lots(300) })).toContain('party-10')
  })
  it('cheer and boss badges come from the extras', () => {
    expect(run(empty())).not.toContain('first-cheer')
    expect(run(empty(), { cheersSent: 1 })).toContain('first-cheer')
    expect(run(empty(), { bossesDefeated: 1 })).toContain('first-boss')
  })
})
