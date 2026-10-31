import { describe, it, expect } from 'vitest'
import { calendarSection, financeSection, foodSection, healthSection, monthRange, routinesSection, scorecardSection, studySection, travelSection } from '../src/lib/reportSections'
import type { CalEvent } from '../src/types'
import { reportInput, routine, tick } from './reportFixture'

const OCT = monthRange('2026-10', '2026-11-03')
const exp = (id: string, date: string, amount: number, category: string, extra: Record<string, unknown> = {}) => ({ id, date, amount, category, note: '', member_id: 'a', ...extra })

describe('monthRange', () => {
  it('is the whole month once it is over', () => {
    expect(OCT).toEqual({ month: '2026-10', first: '2026-10-01', last: '2026-10-31', days: 31, partial: false })
  })
  it('stops at today for the current month', () => {
    expect(monthRange('2026-11', '2026-11-03')).toEqual({ month: '2026-11', first: '2026-11-01', last: '2026-11-03', days: 3, partial: true })
  })
})

describe('scorecardSection', () => {
  it('counts ticks once per person, ignores deleted routines and other months, and compares with last month', () => {
    const input = reportInput({
      routines: [routine('r1')],
      logs: [tick('1', 'r1', 'a', '2026-10-01'), tick('2', 'r1', 'a', '2026-10-01'), tick('3', 'r1', 'a', '2026-10-02'), tick('4', 'gone', 'a', '2026-10-03'), tick('5', 'r1', 'a', '2026-09-30'), tick('6', 'r1', 'a', '2026-11-01')],
    })
    const s = scorecardSection(OCT, input)
    expect(s.ticksByMember).toEqual({ a: 2, b: 0 })
    expect(s.prevTicksByMember).toEqual({ a: 1, b: 0 })
  })
  it('completion is ticks against what was expected, or null with nothing expected', () => {
    const input = reportInput({ routines: [routine('r1')], logs: [tick('1', 'r1', 'a', '2026-10-01'), tick('2', 'r1', 'a', '2026-10-02')] })
    const s = scorecardSection(OCT, input)
    expect(s.doneTotal).toBe(2)
    expect(s.expectedTotal).toBe(62) // 31 days for each of two people
    expect(s.completionPct).toBe(Math.round((2 / 62) * 100))
    expect(scorecardSection(OCT, reportInput()).completionPct).toBeNull()
  })
  it('finds the best streak inside the month per person', () => {
    const input = reportInput({ routines: [routine('r1')], logs: [tick('1', 'r1', 'a', '2026-10-01'), tick('2', 'r1', 'a', '2026-10-02'), tick('3', 'r1', 'a', '2026-10-03'), tick('4', 'r1', 'b', '2026-10-10')] })
    expect(scorecardSection(OCT, input).bestStreakByMember).toEqual({ a: 3, b: 1 })
  })
  it('reports what was spent this month and last', () => {
    const input = reportInput({ expenses: [exp('e1', '2026-10-05', 100, 'dining'), exp('e2', '2026-09-05', 40, 'dining')] })
    const s = scorecardSection(OCT, input)
    expect([s.spent, s.prevSpent]).toEqual([100, 40])
  })
})

describe('routinesSection', () => {
  it('gives each person their own row for a routine that is not shared', () => {
    const rows = routinesSection(OCT, reportInput({ routines: [routine('r1', { name: 'Walk' })], logs: [tick('1', 'r1', 'a', '2026-10-01')] }))
    expect(rows.map((r) => [r.memberId, r.count, r.expected])).toEqual([['b', 0, 31], ['a', 1, 31]])
  })
  it('counts either partner for a shared routine, on one row', () => {
    const r3 = routine('r3', { name: 'Sunday mass', cadence: 'weekly', weekday: 0, shared: true })
    const rows = routinesSection(OCT, reportInput({ routines: [r3], logs: [tick('1', 'r3', 'a', '2026-10-04'), tick('2', 'r3', 'b', '2026-10-11')] }))
    expect(rows).toEqual([{ id: 'r3', name: 'Sunday mass', bucket: 'health', memberId: 'shared', count: 2, expected: 4, pct: 50 }])
  })
  it('keeps a one-person routine to that person and skips inactive routines', () => {
    const rows = routinesSection(OCT, reportInput({ routines: [routine('r1', { applies_to: 'b' }), routine('r2', { active: false })] }))
    expect(rows.map((r) => [r.id, r.memberId])).toEqual([['r1', 'b']])
  })
  it('sorts weakest first with unknown percentages last, and never divides by zero', () => {
    const input = reportInput({
      today: '2026-11-03',
      routines: [routine('hi', { applies_to: 'a' }), routine('lo', { applies_to: 'a' }), routine('sat', { applies_to: 'a', cadence: 'weekly', weekday: 6 })],
      logs: [tick('1', 'hi', 'a', '2026-11-01'), tick('2', 'hi', 'a', '2026-11-02'), tick('3', 'hi', 'a', '2026-11-03'), tick('4', 'lo', 'a', '2026-11-01')],
    })
    const rows = routinesSection(monthRange('2026-11', '2026-11-03'), input)
    expect(rows.map((r) => [r.id, r.pct])).toEqual([['lo', 33], ['hi', 100], ['sat', null]])
  })
})

describe('healthSection', () => {
  it('counts workouts, minutes and types per person for the month only', () => {
    const act = (id: string, date: string, member_id: string, type: string, minutes: number | null) => ({ id, date, member_id, type, minutes })
    const h = healthSection(OCT, reportInput({ activities: [act('1', '2026-10-02', 'a', 'run', 30), act('2', '2026-10-09', 'a', 'run', null), act('3', '2026-10-09', 'a', 'swim', 20), act('4', '2026-09-30', 'a', 'run', 99)] }))
    expect(h.byMember.a).toEqual({ workouts: 3, minutes: 50, byType: { run: 2, swim: 1 } })
    expect(h.byMember.b).toEqual({ workouts: 0, minutes: 0, byType: {} })
  })
  it('reports how often a timed routine was on time', () => {
    const lights = routine('r2', { name: 'Lights out', time_rule: 'before 22:30' })
    const h = healthSection(OCT, reportInput({ routines: [lights], logs: [tick('1', 'r2', 'a', '2026-10-01', '22:00'), tick('2', 'r2', 'a', '2026-10-02', '23:00')] }))
    expect(h.timed).toEqual([
      { routineId: 'r2', name: 'Lights out', memberId: 'a', logged: 2, onTime: 1, pct: 50 },
      { routineId: 'r2', name: 'Lights out', memberId: 'b', logged: 0, onTime: 0, pct: null },
    ])
  })
  it('lists weeks starting in the month with no workout from anyone', () => {
    const h = healthSection(OCT, reportInput({ activities: [{ id: '1', date: '2026-10-07', member_id: 'a', type: 'run', minutes: 10 }] }))
    expect(h.weeksWithoutWorkout).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
  })
})

describe('studySection', () => {
  it('counts milestones by their week start and trivia all time', () => {
    const ms = (id: string, week_start: string, member_id: string, done: boolean) => ({ id, week_start, member_id, text: id, done })
    const s = studySection(OCT, reportInput({
      milestones: [ms('1', '2026-10-04', 'a', true), ms('2', '2026-10-04', 'a', false), ms('3', '2026-10-05', 'b', true), ms('4', '2026-09-28', 'a', true), ms('5', '2026-11-02', 'a', true)],
      attempts: [{ id: 'x', question_id: 'q1', member_id: 'a', chosen_index: 0, correct: true }, { id: 'y', question_id: 'q2', member_id: 'a', chosen_index: 1, correct: false }],
    }))
    expect(s.milestones).toEqual({ a: { done: 1, total: 2 }, b: { done: 1, total: 1 } })
    expect(s.triviaAllTime).toEqual({ a: { attempts: 2, correct: 1 }, b: { attempts: 0, correct: 0 } })
  })
})

describe('travelSection', () => {
  it('lists the month\'s trips with their places', () => {
    const t = travelSection(OCT, reportInput({
      trips: [{ id: 't1', place_id: 'p1', planned_month: '2026-10', status: 'done' }, { id: 't2', place_id: 'zz', planned_month: '2026-10', status: 'planned' }, { id: 't3', place_id: 'p1', planned_month: '2026-11', status: 'planned' }],
      places: [{ id: 'p1', name: 'Austin', drive_hours: 3, rank: 1, visited: true }],
    }))
    expect(t).toEqual({ planned: 2, done: 1, trips: [{ place: 'Austin', status: 'done' }, { place: 'Unknown place', status: 'planned' }] })
  })
})

describe('foodSection', () => {
  it('compares grocery spending with the groceries bill and counts nights in', () => {
    const f = foodSection(OCT, reportInput({
      expenses: [exp('e1', '2026-10-04', 120, 'groceries'), exp('e2', '2026-09-04', 999, 'groceries')],
      bills: [{ id: 'b1', name: 'Groceries', amount: 500, category: 'Food', kind: 'recurring', due_month: null, paid: false }],
      nights: [{ id: 'n1', date: '2026-10-09', type: 'game', activity: 'x', snack: 'y', host_id: 'a' }, { id: 'n2', date: '2026-10-16', type: 'game', activity: 'x', snack: 'y', host_id: 'b' }, { id: 'n3', date: '2026-10-23', type: 'movie', activity: 'x', snack: 'y', host_id: 'a' }, { id: 'n4', date: '2026-09-23', type: 'movie', activity: 'x', snack: 'y', host_id: 'a' }],
      routines: [routine('r5', { name: 'Grocery shopping', bucket: 'food', cadence: 'biweekly', shared: true })],
      logs: [tick('1', 'r5', 'a', '2026-10-03'), tick('2', 'r5', 'b', '2026-10-17')],
    }))
    expect(f).toEqual({ grocerySpent: 120, groceryBudget: 500, nightsByType: { game: 2, movie: 1 }, groceryRoutinePct: 67 })
  })
  it('has no grocery routine percentage when there is no such routine', () => {
    expect(foodSection(OCT, reportInput()).groceryRoutinePct).toBeNull()
  })
})

describe('financeSection', () => {
  const bill = (id: string, name: string, amount: number, category: string, kind: 'recurring' | 'one_time' = 'recurring', extra: Record<string, unknown> = {}) => ({ id, name, amount, category, kind, due_month: null, paid: false, ...extra })
  const input = () =>
    reportInput({
      incomeConfigured: 19200,
      bills: [bill('b1', 'Rent', 1700, 'housing'), bill('b2', 'Netflix', 7, 'subscriptions'), bill('b3', 'Card payoff', 2200, 'debt', 'one_time', { due_month: '2026-10', paid: true })],
      payments: [{ id: 'p1', bill_id: 'b1', month: '2026-10', paid_on: '2026-10-03' }],
      budgets: [{ id: 'bu1', category: 'dining', amount: 100 }],
      expenses: [exp('e1', '2026-10-06', 150, 'dining'), exp('e2', '2026-10-07', 5000, 'paycheck', { kind: 'income' }), exp('e3', '2026-09-06', 50, 'dining'), exp('e4', '2026-09-08', 300, 'groceries')],
      savings: [{ id: 's1', month: '2026-10', amount: 300 }, { id: 's2', month: '2026-10', amount: 200 }, { id: 's3', month: '2026-09', amount: 999 }],
    })
  it('adds up money in, money out, savings and bills', () => {
    const f = financeSection(OCT, input())
    expect(f).toMatchObject({ incomeConfigured: 19200, incomeLogged: 5000, spent: 4050, savedThisMonth: 500, savingsTarget: 10000, billsPaid: 1, billsDue: 2, unpaid: ['Netflix'], payoffsCleared: ['Card payoff'] })
  })
  it('compares each category with its budget and drops empty ones', () => {
    const cats = financeSection(OCT, input()).categories
    expect(cats.find((c) => c.category === 'dining')).toEqual({ category: 'dining', budget: 100, spent: 150, ratio: 1.5 })
    expect(cats.find((c) => c.category === 'housing')).toEqual({ category: 'housing', budget: 1700, spent: 1700, ratio: 1 })
    expect(cats.find((c) => c.category === 'gifts')).toBeUndefined()
  })
  it('names the three biggest changes since last month', () => {
    expect(financeSection(OCT, input()).changes).toEqual([
      { category: 'debt', delta: 2200 },
      { category: 'housing', delta: 1700 },
      { category: 'groceries', delta: -300 },
    ])
  })
  it('gives ratio null for a category with no budget', () => {
    const f = financeSection(OCT, reportInput({ expenses: [exp('e1', '2026-10-06', 30, 'gifts')] }))
    expect(f.categories.find((c) => c.category === 'gifts')).toEqual({ category: 'gifts', budget: 0, spent: 30, ratio: null })
  })
})

describe('calendarSection', () => {
  const ev = (over: Partial<CalEvent>): CalEvent => ({ id: 'e', title: 'Thing', date: '2026-10-05', time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on: [], ...over })
  it('counts ticked, missed and still-to-come occurrences', () => {
    const events = [ev({ id: 'w', repeat: 'weekly', done_on: ['2026-10-05', '2026-10-12'] }), ev({ id: 'x', date: '2026-11-10' })]
    expect(calendarSection(OCT, reportInput({ events }))).toEqual({ done: 2, missed: 2, upcoming: 0 })
  })
  it('treats today as still to come in the current month', () => {
    const r = monthRange('2026-11', '2026-11-03')
    const events = [ev({ id: 'a', date: '2026-11-02' }), ev({ id: 'b', date: '2026-11-03' })]
    expect(calendarSection(r, reportInput({ events }))).toEqual({ done: 0, missed: 1, upcoming: 1 })
  })
})
