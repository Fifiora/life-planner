import { describe, it, expect } from 'vitest'
import { EPISODE_TITLES, episodeFor, episodeMonthFor, finishedMonths } from '../src/lib/episode'
import type { GameData } from '../src/lib/xp'
import type { Expense, Routine } from '../src/types'

const routine: Routine = { id: 'r1', name: 'r1', bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true }
const base = (): GameData & { expenses: Expense[] } => ({ routines: [routine], logs: [], activities: [], milestones: [], attempts: [], payments: [], bills: [], expenses: [] })
const tick = (id: string, member_id: string, date: string) => ({ id, routine_id: 'r1', member_id, date, done: true, value: null })
const members = [{ id: 'a', display_name: 'Ada' }, { id: 'b', display_name: 'Ben' }]

describe('titles', () => {
  it('has the six agreed titles', () => {
    expect(EPISODE_TITLES).toEqual(['The Fresh Start', 'The Savings Push', 'Rising Tide', 'Steady Footing', 'The Long Road', 'Bright Horizon'])
  })
  it('numbers months from the plan start and wraps', () => {
    expect(episodeFor('2026-10', base(), members).title).toBe('Arc 1: The Fresh Start')
    expect(episodeFor('2026-11', base(), members).title).toBe('Arc 2: The Savings Push')
    expect(episodeFor('2027-04', base(), members).title).toBe('Arc 7: The Fresh Start')
  })
  it('still gives a title for a month before the plan', () => {
    expect(EPISODE_TITLES.some((t) => episodeFor('2026-09', base(), members).title.endsWith(t))).toBe(true)
  })
})

describe('episodeFor', () => {
  it('is all zeros for an empty month, listing both people', () => {
    expect(episodeFor('2026-11', base(), members)).toMatchObject({ month: '2026-11', ticksByMember: { a: 0, b: 0 }, bestStreak: 0, billsPaid: 0, spent: 0 })
  })
  it('counts only that month, once per person per routine per day', () => {
    const d = { ...base(), logs: [tick('1', 'a', '2026-11-01'), tick('2', 'a', '2026-11-01'), tick('3', 'a', '2026-11-02'), tick('4', 'b', '2026-10-31'), tick('5', 'b', '2026-12-01')] }
    expect(episodeFor('2026-11', d, members).ticksByMember).toEqual({ a: 2, b: 0 })
  })
  it('finds the best streak inside the month', () => {
    const d = { ...base(), logs: [tick('1', 'a', '2026-11-01'), tick('2', 'a', '2026-11-02'), tick('3', 'a', '2026-11-03'), tick('4', 'b', '2026-11-10')] }
    expect(episodeFor('2026-11', d, members).bestStreak).toBe(3)
  })
  it('counts bill payments of that month and what was spent', () => {
    const d = { ...base(), payments: [{ id: 'p1', bill_id: 'b', month: '2026-11', paid_on: '2026-11-03' }, { id: 'p2', bill_id: 'b', month: '2026-10', paid_on: '2026-10-03' }], expenses: [{ id: 'e1', date: '2026-11-05', amount: 42, category: 'food', note: '', member_id: 'a' }] }
    const e = episodeFor('2026-11', d, members)
    expect(e.billsPaid).toBe(1)
    expect(e.spent).toBe(42)
  })
})

describe('when to show an episode', () => {
  it('shows last month during the first 7 days', () => {
    expect(episodeMonthFor('2026-11-03')).toBe('2026-10')
    expect(episodeMonthFor('2026-11-07')).toBe('2026-10')
    expect(episodeMonthFor('2027-01-02')).toBe('2026-12')
  })
  it('shows nothing later in the month or before the plan began', () => {
    expect(episodeMonthFor('2026-11-08')).toBeNull()
    expect(episodeMonthFor('2026-10-03')).toBeNull()
  })
  it('lists finished months since the plan start, newest first', () => {
    expect(finishedMonths('2026-10-31')).toEqual([])
    expect(finishedMonths('2026-11-03')).toEqual(['2026-10'])
    expect(finishedMonths('2027-01-15')).toEqual(['2026-12', '2026-11', '2026-10'])
  })
})
