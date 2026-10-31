import { describe, it, expect } from 'vitest'
import { levelFor, levelProgress, memberXp, partyXp, xpForLevel, type GameData } from '../src/lib/xp'
import type { Routine } from '../src/types'

const routine = (id: string, bucket: Routine['bucket'] = 'health'): Routine => ({ id, name: id, bucket, cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true })
const empty = (): GameData => ({ routines: [], logs: [], activities: [], milestones: [], attempts: [], payments: [], bills: [] })
const tick = (id: string, routine_id: string, member_id: string, date: string) => ({ id, routine_id, member_id, date, done: true, value: null })

describe('levels', () => {
  it('uses 50 * n * (n - 1) XP per level', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600])
    expect([0, 99, 100, 299, 300, 600].map(levelFor)).toEqual([1, 1, 2, 2, 3, 4])
  })
  it('says how far into the level you are', () => {
    expect(levelProgress(150)).toEqual({ level: 2, into: 50, needed: 200 })
    expect(levelProgress(0)).toEqual({ level: 1, into: 0, needed: 100 })
  })
})

describe('memberXp', () => {
  it('is zero for an empty planner', () => {
    expect(memberXp(empty(), 'a')).toEqual({ total: 0, byBucket: { health: 0, study: 0, travel: 0, food: 0, finance: 0 } })
  })
  it('gives 10 for a tick plus a streak bonus, in the routine bucket', () => {
    const d = { ...empty(), routines: [routine('r1')], logs: [tick('l1', 'r1', 'a', '2026-11-04')] }
    const x = memberXp(d, 'a')
    expect(x.byBucket.health).toBe(12)
    expect(x.total).toBe(12)
  })
  it('gives the streak bonus once a day, however many routines were ticked', () => {
    const d = { ...empty(), routines: [routine('r1'), routine('r2')], logs: [tick('l1', 'r1', 'a', '2026-11-04'), tick('l2', 'r2', 'a', '2026-11-04')] }
    expect(memberXp(d, 'a').total).toBe(22)
  })
  it('counts the same member, routine and day once', () => {
    const d = { ...empty(), routines: [routine('r1')], logs: [tick('l1', 'r1', 'a', '2026-11-04'), tick('l2', 'r1', 'a', '2026-11-04')] }
    expect(memberXp(d, 'a').total).toBe(12)
  })
  it('ignores a tick whose routine is gone', () => {
    const d = { ...empty(), logs: [tick('l1', 'gone', 'a', '2026-11-04')] }
    expect(memberXp(d, 'a').total).toBe(0)
  })
  it('caps the streak bonus at 20 a day', () => {
    const dates = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    const d = { ...empty(), routines: [routine('r1')], logs: dates.map((x, i) => tick(`l${i}`, 'r1', 'a', x)) }
    const bonus = dates.map((_, i) => Math.min(20, 2 * (i + 1))).reduce((s, n) => s + n, 0)
    expect(memberXp(d, 'a').total).toBe(12 * 10 + bonus)
  })
  it('pays 15 for a health activity plus 1 per 10 minutes, up to 15 more', () => {
    const act = (id: string, minutes: number | null) => ({ id, date: '2026-11-04', member_id: 'a', type: 'run', minutes })
    expect(memberXp({ ...empty(), activities: [act('x', 45)] }, 'a').byBucket.health).toBe(19)
    expect(memberXp({ ...empty(), activities: [act('x', null)] }, 'a').byBucket.health).toBe(15)
    expect(memberXp({ ...empty(), activities: [act('x', 400)] }, 'a').byBucket.health).toBe(30)
  })
  it('pays 15 for a finished study milestone only', () => {
    const ms = (id: string, done: boolean) => ({ id, week_start: '2026-11-02', member_id: 'a', text: 't', done })
    expect(memberXp({ ...empty(), milestones: [ms('m1', true), ms('m2', false)] }, 'a').byBucket.study).toBe(15)
  })
  it('pays once per question: 8 if any attempt was right, otherwise 3, whatever order the rows are in', () => {
    const at = (id: string, q: string, correct: boolean) => ({ id, question_id: q, member_id: 'a', chosen_index: 0, correct })
    const study = (attempts: ReturnType<typeof at>[]) => memberXp({ ...empty(), attempts }, 'a').byBucket.study
    expect(study([at('1', 'q1', true), at('2', 'q1', true)])).toBe(8)
    expect(study([at('1', 'q1', false), at('2', 'q1', true)])).toBe(8)
    expect(study([at('1', 'q1', true), at('2', 'q1', false)])).toBe(8)
    expect(study([at('1', 'q1', false), at('2', 'q1', false)])).toBe(3)
    expect(study([at('1', 'q1', true), at('2', 'q2', false)])).toBe(11)
  })
  it('puts the streak bonus in the same area whatever order the ticks were saved in', () => {
    const food = routine('r2', 'food')
    const rows = [tick('1', 'r1', 'a', '2026-11-04'), tick('2', 'r2', 'a', '2026-11-04')]
    const one = memberXp({ ...empty(), routines: [routine('r1'), food], logs: rows }, 'a')
    const two = memberXp({ ...empty(), routines: [routine('r1'), food], logs: [...rows].reverse() }, 'a')
    expect(two.byBucket).toEqual(one.byBucket)
    expect(one.byBucket).toEqual({ health: 12, study: 0, travel: 0, food: 10, finance: 0 })
  })
  it('pays 20 finance XP per bill payment', () => {
    const d = { ...empty(), payments: [{ id: 'p1', bill_id: 'b', month: '2026-11', paid_on: '2026-11-03', member_id: 'a' }] }
    expect(memberXp(d as GameData, 'a').byBucket.finance).toBe(20)
  })
  it('keeps each person to their own rows', () => {
    const d = { ...empty(), routines: [routine('r1')], logs: [tick('l1', 'r1', 'a', '2026-11-04'), tick('l2', 'r1', 'b', '2026-11-04')] }
    expect(memberXp(d, 'b').total).toBe(12)
    expect(partyXp(d, ['a', 'b'])).toBe(24)
  })
})
