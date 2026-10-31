import { describe, it, expect } from 'vitest'
import { BOSSES, bossForWeek, bossProgress } from '../src/lib/boss'
import type { GameData } from '../src/lib/xp'
import type { Routine } from '../src/types'
import { addDays } from '../src/lib/dates'

const routine = (id: string): Routine => ({ id, name: id, bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true })
const empty = (): GameData => ({ routines: [routine('r1')], logs: [], activities: [], milestones: [], attempts: [], payments: [], bills: [] })
const tick = (id: string, routine_id: string, member_id: string, date: string) => ({ id, routine_id, member_id, date, done: true, value: null })
const boss = (id: string) => BOSSES.find((b) => b.id === id)!
const WEEK = '2026-11-02' // a Monday

describe('the bosses', () => {
  it('are four, with the agreed targets', () => {
    expect(BOSSES.map((b) => [b.id, b.name, b.target])).toEqual([
      ['wraith', 'Lord Snooze', 60],
      ['giant', 'The Couch Colossus', 8],
      ['sphinx', 'The Book Sphinx', 6],
      ['twins', 'The Together Twins', 5],
    ])
  })
  it('rotate by week from the plan start', () => {
    expect(bossForWeek('2026-10-26').id).toBe('wraith')
    expect(bossForWeek('2026-11-02').id).toBe('giant')
    expect(bossForWeek('2026-11-09').id).toBe('sphinx')
    expect(bossForWeek('2026-11-16').id).toBe('twins')
    expect(bossForWeek('2026-11-23').id).toBe('wraith')
  })
  it('still give a boss for a week before the plan started', () => {
    expect(bossForWeek('2026-10-19').id).toBe('twins')
  })
})

describe('bossProgress', () => {
  it('starts at zero for every boss', () => {
    for (const b of BOSSES) expect(bossProgress(b, WEEK, empty(), ['a', 'b'])).toEqual({ value: 0, target: b.target, defeated: false })
  })

  it('wraith: counts ticks from either person in the week, once each, and a Sunday belongs to the Monday-start week', () => {
    const d = {
      ...empty(),
      logs: [tick('1', 'r1', 'a', '2026-11-08'), tick('2', 'r1', 'b', '2026-11-08'), tick('3', 'r1', 'a', '2026-11-08'), tick('4', 'r1', 'a', '2026-11-09'), tick('5', 'r1', 'a', '2026-11-01')],
    }
    expect(bossProgress(boss('wraith'), WEEK, d, ['a', 'b']).value).toBe(2)
  })

  it('wraith: defeated at exactly 60', () => {
    const routines = Array.from({ length: 9 }, (_, i) => routine(`r${i}`))
    const logs = routines.flatMap((r, i) => Array.from({ length: 7 }, (_, d) => tick(`${i}-${d}`, r.id, 'a', addDays(WEEK, d))))
    const d = { ...empty(), routines }
    expect(bossProgress(boss('wraith'), WEEK, { ...d, logs: logs.slice(0, 59) }, ['a']).defeated).toBe(false)
    expect(bossProgress(boss('wraith'), WEEK, { ...d, logs: logs.slice(0, 60) }, ['a'])).toEqual({ value: 60, target: 60, defeated: true })
  })

  it('giant: counts activities dated in the week', () => {
    const act = (id: string, date: string) => ({ id, date, member_id: 'a', type: 'run', minutes: 10 })
    const d = { ...empty(), activities: [act('1', '2026-11-02'), act('2', '2026-11-08'), act('3', '2026-11-09'), act('4', '2026-11-01')] }
    expect(bossProgress(boss('giant'), WEEK, d, ['a']).value).toBe(2)
  })

  it('sphinx: counts finished milestones for that week only', () => {
    const ms = (id: string, week_start: string, done: boolean) => ({ id, week_start, member_id: 'a', text: id, done })
    const d = { ...empty(), milestones: [ms('1', WEEK, true), ms('2', WEEK, false), ms('3', '2026-11-09', true)] }
    expect(bossProgress(boss('sphinx'), WEEK, d, ['a']).value).toBe(1)
  })

  it('twins: one person alone cannot beat them', () => {
    const d = { ...empty(), logs: Array.from({ length: 5 }, (_, i) => tick(`s${i}`, 'r1', 'a', addDays(WEEK, i))) }
    expect(bossProgress(boss('twins'), WEEK, d, ['a']).value).toBe(0)
  })

  it('twins: a day counts only when both people ticked something', () => {
    const d = { ...empty(), logs: [tick('1', 'r1', 'a', '2026-11-02'), tick('2', 'r1', 'b', '2026-11-02'), tick('3', 'r1', 'a', '2026-11-03'), tick('4', 'r1', 'b', '2026-11-04')] }
    expect(bossProgress(boss('twins'), WEEK, d, ['a', 'b']).value).toBe(1)
  })
})
