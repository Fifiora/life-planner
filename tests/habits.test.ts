import { describe, it, expect } from 'vitest'
import { activityWeek, scorecard, timeStats } from '../src/lib/habits'
import type { Routine, RoutineLog } from '../src/types'

const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1', name: 'x', bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true, ...over,
})
const log = (date: string, value: string | null = null, member = 'a', done = true, routine_id = 'r1'): RoutineLog => ({
  id: `${routine_id}${member}${date}`, routine_id, member_id: member, date, done, value,
})

describe('timeStats', () => {
  const lights = routine({ time_rule: 'before 22:30' })
  it('counts on-time nights and averages the time, treating after-midnight as late', () => {
    const logs = [log('2026-11-01', '21:50'), log('2026-11-02', '22:20'), log('2026-11-03', '23:10', 'a', false), log('2026-11-04', '00:15', 'a', false)]
    expect(timeStats(logs, lights, '2026-11-04', 7)).toEqual({ logged: 4, onTime: 2, avg: '22:54' })
  })
  it('only looks at the chosen window, person and routine', () => {
    const logs = [log('2026-10-20', '21:00'), log('2026-11-03', '21:30', 'b'), log('2026-11-03', '22:00', 'a'), log('2026-11-03', '20:00', 'a', true, 'other')]
    expect(timeStats(logs, lights, '2026-11-04', 7, 'a')).toEqual({ logged: 1, onTime: 1, avg: '22:00' })
  })
  it('has no average with nothing logged', () => {
    expect(timeStats([], lights, '2026-11-04', 7)).toEqual({ logged: 0, onTime: 0, avg: null })
  })
})

describe('scorecard', () => {
  it('compares ticks this month with how many were expected so far', () => {
    const logs = ['01', '02', '03', '04', '05', '06', '07'].map((d) => log(`2026-11-${d}`))
    expect(scorecard(routine(), logs, '2026-11-10')).toEqual({ count: 7, expected: 10, pct: 70 })
  })
  it('expects one per matching weekday for a weekly routine', () => {
    const sunday = routine({ cadence: 'weekly', weekday: 0 })
    expect(scorecard(sunday, [log('2026-11-01')], '2026-11-10')).toEqual({ count: 1, expected: 2, pct: 50 })
  })
  it('expects one a month for a monthly routine and ignores earlier months', () => {
    const monthly = routine({ cadence: 'monthly' })
    expect(scorecard(monthly, [log('2026-10-28'), log('2026-11-03')], '2026-11-10')).toEqual({ count: 1, expected: 1, pct: 100 })
  })
  it('never goes over 100%', () => {
    const monthly = routine({ cadence: 'monthly' })
    expect(scorecard(monthly, [log('2026-11-02'), log('2026-11-03')], '2026-11-10').pct).toBe(100)
  })
})

describe('activityWeek', () => {
  const acts = [
    { id: '1', date: '2026-11-04', member_id: 'a', type: 'run', minutes: 30 },
    { id: '2', date: '2026-11-04', member_id: 'a', type: 'walk', minutes: 20 },
    { id: '3', date: '2026-11-02', member_id: 'b', type: 'weights', minutes: 45 },
    { id: '4', date: '2026-10-20', member_id: 'a', type: 'run', minutes: 30 },
  ]
  it('summarises the last 7 days', () => {
    expect(activityWeek(acts, '2026-11-04')).toEqual({ activeDays: 2, minutes: 95, byType: { run: 1, walk: 1, weights: 1 } })
  })
  it('can be limited to one person', () => {
    expect(activityWeek(acts, '2026-11-04', 'a')).toEqual({ activeDays: 1, minutes: 50, byType: { run: 1, walk: 1 } })
  })
})
