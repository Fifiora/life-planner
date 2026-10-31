import { describe, it, expect } from 'vitest'
import { PLAN_START } from '../src/lib/dates'
import { dayCompletion, dayMarkers, eventOccurrences, monthGrid, routinesOn, validateEvent } from '../src/lib/calendar'
import type { CalEvent, Routine, RoutineLog } from '../src/types'

const ev = (over: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1', title: 'Dentist', date: '2026-10-26', time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on: [], ...over,
})
const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1', name: 'Walk', bucket: 'health', sub_bucket: 'physical', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true, shared: false, ...over,
})

describe('PLAN_START', () => {
  it('is Monday 26 Oct 2026', () => {
    expect(PLAN_START).toBe('2026-10-26')
    expect(new Date(`${PLAN_START}T00:00:00Z`).getUTCDay()).toBe(1)
  })
})

describe('monthGrid', () => {
  it('gives six Monday-first weeks for Oct 2026', () => {
    const g = monthGrid('2026-10')
    expect(g).toHaveLength(6)
    g.forEach((row) => expect(row).toHaveLength(7))
    expect(g[0][0]).toBe('2026-09-28')
    expect(g.flat()).toContain('2026-10-26')
  })
  it('works far in the future and the past', () => {
    expect(monthGrid('2040-02').flat()).toHaveLength(42)
    expect(monthGrid('1999-12').flat()).toHaveLength(42)
    expect(monthGrid('2100-06').flat().every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true)
  })
  it('includes 29 Feb in a leap year', () => {
    expect(monthGrid('2028-02').flat()).toContain('2028-02-29')
  })
})

describe('eventOccurrences', () => {
  it('expands weekly and biweekly repeats inside a window', () => {
    expect(eventOccurrences(ev({ repeat: 'weekly' }), '2026-10-26', '2026-11-16')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'])
    expect(eventOccurrences(ev({ repeat: 'biweekly' }), '2026-10-26', '2026-11-16')).toEqual(['2026-10-26', '2026-11-09'])
  })
  it('clamps monthly repeats on the 31st to the last day of short months', () => {
    expect(eventOccurrences(ev({ date: '2026-01-31', repeat: 'monthly' }), '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-31'])
  })
  it('clamps a 29 Feb yearly repeat in non-leap years', () => {
    expect(eventOccurrences(ev({ date: '2024-02-29', repeat: 'yearly' }), '2025-01-01', '2028-12-31')).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })
  it('returns a single date or nothing for a non-repeating event', () => {
    expect(eventOccurrences(ev(), '2026-10-01', '2026-10-31')).toEqual(['2026-10-26'])
    expect(eventOccurrences(ev(), '2026-11-01', '2026-11-30')).toEqual([])
  })
  it('stops at repeat_until and ignores a start after it', () => {
    expect(eventOccurrences(ev({ repeat: 'weekly', repeat_until: '2026-11-02' }), '2026-10-01', '2026-12-31')).toEqual(['2026-10-26', '2026-11-02'])
    expect(eventOccurrences(ev({ repeat: 'weekly', repeat_until: '2026-10-01' }), '2026-10-01', '2026-12-31')).toEqual([])
  })
  it('skips corrupt rows instead of throwing', () => {
    expect(eventOccurrences(ev({ date: '' }), '2026-10-01', '2026-12-31')).toEqual([])
    expect(eventOccurrences({ ...ev(), date: undefined } as unknown as CalEvent, '2026-10-01', '2026-12-31')).toEqual([])
  })
  it('keeps expanding in the far future', () => {
    expect(eventOccurrences(ev({ repeat: 'weekly' }), '2100-01-01', '2100-01-31').length).toBeGreaterThanOrEqual(4)
  })
})

describe('routinesOn', () => {
  const anchor = '2026-11-02'
  it('puts daily routines on every day', () => {
    expect(routinesOn('2031-05-05', [routine()], anchor)).toHaveLength(1)
  })
  it('puts a weekly routine on its weekday only', () => {
    const sunday = routine({ id: 's', cadence: 'weekly', weekday: 0 })
    expect(routinesOn('2026-11-01', [sunday], anchor)).toHaveLength(1)
    expect(routinesOn('2026-11-02', [sunday], anchor)).toHaveLength(0)
  })
  it('alternates biweekly routines by anchor week, also before the anchor', () => {
    const bi = routine({ id: 'b', cadence: 'biweekly', weekday: 1 })
    expect(routinesOn('2026-11-02', [bi], anchor)).toHaveLength(1)
    expect(routinesOn('2026-11-09', [bi], anchor)).toHaveLength(0)
    expect(routinesOn('2026-11-16', [bi], anchor)).toHaveLength(1)
    expect(routinesOn('2026-10-19', [bi], anchor)).toHaveLength(1)
    expect(routinesOn('2026-10-26', [bi], anchor)).toHaveLength(0)
  })
  it('never pins a monthly routine without a weekday to a day', () => {
    expect(routinesOn('2026-11-02', [routine({ cadence: 'monthly' })], anchor)).toHaveLength(0)
  })
})

describe('dayMarkers', () => {
  it('lists distinct buckets from routines and events', () => {
    const m = dayMarkers('2026-10-26', { routines: [routine(), routine({ id: 'r2' }), routine({ id: 'r3', bucket: 'food' })], events: [ev({ category: 'study' }), ev({ id: 'e2', category: 'other' })], anchor: '2026-11-02' })
    expect([...m].sort()).toEqual(['food', 'health', 'other', 'study'])
  })
})

describe('dayCompletion', () => {
  const logs: RoutineLog[] = [
    { id: 'l1', routine_id: 'r1', member_id: 'a', date: '2026-10-27', done: true, value: null },
    { id: 'l2', routine_id: 'r2', member_id: 'b', date: '2026-10-27', done: true, value: null },
  ]
  it('counts only my log for non-shared routines', () => {
    const rs = [routine({ id: 'r1' }), routine({ id: 'r2' })]
    expect(dayCompletion('2026-10-27', rs, logs, 'a', '2026-11-02')).toEqual({ done: 1, total: 2 })
  })
  it('counts a partner log for shared routines', () => {
    const rs = [routine({ id: 'r1' }), routine({ id: 'r2', shared: true })]
    expect(dayCompletion('2026-10-27', rs, logs, 'a', '2026-11-02')).toEqual({ done: 2, total: 2 })
  })
})

describe('validateEvent', () => {
  const ok = { title: 'Dentist', date: '2026-11-03', repeat: 'none' as const, repeat_until: null }
  it('accepts a valid event', () => expect(validateEvent(ok)).toBeNull())
  it('rejects an empty title', () => expect(validateEvent({ ...ok, title: '  ' })).toBe('Give the event a title.'))
  it('rejects an impossible date', () => expect(validateEvent({ ...ok, date: '2026-13-40' })).toBe('Pick a valid date.'))
  it('rejects repeat_until before the date', () => expect(validateEvent({ ...ok, repeat: 'weekly', repeat_until: '2026-11-01' })).toBe('"Repeat until" must be on or after the date.'))
})
