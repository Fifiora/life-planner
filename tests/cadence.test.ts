import { describe, it, expect } from 'vitest'
import { periodKey, periodProgress, streak, meetsTimeRule } from '../src/lib/cadence'
import type { Routine, RoutineLog } from '../src/types'

const ANCHOR = '2026-01-05'

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Walk',
    bucket: 'health',
    cadence: 'daily',
    times_per_period: 1,
    applies_to: 'both',
    place: null,
    time_rule: null,
    weekday: null,
    active: true,
    ...over,
  }
}

function log(date: string, member = 'm1', routine_id = 'r1'): RoutineLog {
  return { id: `${routine_id}-${member}-${date}`, routine_id, member_id: member, date, done: true, value: null }
}

describe('meetsTimeRule', () => {
  it('passes a bedtime before the limit', () => {
    expect(meetsTimeRule('before 22:30', '22:00')).toBe(true)
    expect(meetsTimeRule('before 22:30', '22:30')).toBe(true)
  })
  it('fails a bedtime after the limit', () => {
    expect(meetsTimeRule('before 22:30', '22:31')).toBe(false)
  })
  it('treats a bedtime after midnight as a miss', () => {
    expect(meetsTimeRule('before 22:30', '00:15')).toBe(false)
  })
  it('passes a wake time at or after the earliest time', () => {
    expect(meetsTimeRule('after 04:00', '04:00')).toBe(true)
    expect(meetsTimeRule('after 04:00', '05:10')).toBe(true)
  })
  it('fails a wake time before the earliest time', () => {
    expect(meetsTimeRule('after 04:00', '03:59')).toBe(false)
  })
  it('passes when there is no rule', () => {
    expect(meetsTimeRule(null, '12:00')).toBe(true)
  })
})

describe('periodKey', () => {
  it('names quarters', () => {
    expect(periodKey('quarterly', '2026-11-15', ANCHOR)).toBe('2026-Q4')
  })
  it('names months and weeks', () => {
    expect(periodKey('monthly', '2026-11-15', ANCHOR)).toBe('2026-11')
    expect(periodKey('weekly', '2026-11-01', ANCHOR)).toBe('2026-10-26')
  })
  it('puts two dates 13 days apart from the anchor in the same biweekly period', () => {
    expect(periodKey('biweekly', '2026-01-05', ANCHOR)).toBe(periodKey('biweekly', '2026-01-18', ANCHOR))
    expect(periodKey('biweekly', '2026-01-19', ANCHOR)).not.toBe(periodKey('biweekly', '2026-01-18', ANCHOR))
  })
})

describe('periodProgress', () => {
  it('counts a day once even when both partners tick', () => {
    const logs = [log('2026-11-02', 'm1'), log('2026-11-02', 'm2'), log('2026-11-02', 'm1')]
    expect(periodProgress(routine(), logs, '2026-11-02', ANCHOR)).toEqual({ count: 1, target: 1, done: true })
  })
  it('is done for a weekly routine once the target number of days is met', () => {
    const r = routine({ cadence: 'weekly', times_per_period: 2 })
    expect(periodProgress(r, [log('2026-11-02')], '2026-11-04', ANCHOR).done).toBe(false)
    expect(periodProgress(r, [log('2026-11-02'), log('2026-11-03')], '2026-11-04', ANCHOR).done).toBe(true)
  })
  it('does not carry a monthly tick into the next month', () => {
    const r = routine({ cadence: 'monthly' })
    expect(periodProgress(r, [log('2026-11-03')], '2026-12-01', ANCHOR).done).toBe(false)
  })
  it('ignores logs for other routines and undone logs', () => {
    const undone: RoutineLog = { ...log('2026-11-02'), done: false }
    expect(periodProgress(routine(), [log('2026-11-02', 'm1', 'other'), undone], '2026-11-02', ANCHOR).count).toBe(0)
  })
})

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const logs = [log('2026-11-02'), log('2026-11-03'), log('2026-11-04')]
    expect(streak(routine(), logs, '2026-11-04', ANCHOR)).toBe(3)
  })
  it('keeps the streak alive when today is not ticked yet', () => {
    const logs = [log('2026-11-02'), log('2026-11-03')]
    expect(streak(routine(), logs, '2026-11-04', ANCHOR)).toBe(2)
  })
  it('stops at a missed day', () => {
    const logs = [log('2026-11-01'), log('2026-11-03'), log('2026-11-04')]
    expect(streak(routine(), logs, '2026-11-04', ANCHOR)).toBe(2)
  })
  it('is zero when neither today nor yesterday was done', () => {
    expect(streak(routine(), [log('2026-11-01')], '2026-11-04', ANCHOR)).toBe(0)
  })
  it('counts consecutive weeks for a weekly routine', () => {
    const r = routine({ cadence: 'weekly' })
    const logs = [log('2026-10-20'), log('2026-10-28'), log('2026-11-03')]
    expect(streak(r, logs, '2026-11-04', ANCHOR)).toBe(3)
  })
})
