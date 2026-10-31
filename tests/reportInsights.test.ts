import { describe, it, expect } from 'vitest'
import { insightsFor } from '../src/lib/reportInsights'
import type { MonthRange } from '../src/lib/reportTypes'
import { members } from './reportFixture'

const range = (partial = false): MonthRange => ({ month: '2026-10', first: '2026-10-01', last: partial ? '2026-10-20' : '2026-10-31', days: partial ? 20 : 31, partial })
const zeroMember = () => ({ a: 0, b: 0 })
function base(over: Record<string, unknown> = {}): Parameters<typeof insightsFor>[0] {
  return {
    range: range(),
    members,
    scorecard: { ticksByMember: zeroMember(), prevTicksByMember: zeroMember(), expectedTotal: 0, doneTotal: 0, completionPct: null, bestStreakByMember: zeroMember(), spent: 0, prevSpent: 0 },
    routines: [],
    health: { byMember: { a: { workouts: 0, minutes: 0, byType: {} }, b: { workouts: 0, minutes: 0, byType: {} } }, timed: [], weeksWithoutWorkout: [] },
    study: { milestones: { a: { done: 0, total: 0 }, b: { done: 0, total: 0 } }, triviaAllTime: { a: { attempts: 0, correct: 0 }, b: { attempts: 0, correct: 0 } } },
    travel: { planned: 0, done: 0, trips: [] },
    finance: { incomeConfigured: 0, incomeLogged: 0, spent: 0, savedThisMonth: 0, savingsTarget: 10000, billsPaid: 0, billsDue: 0, unpaid: [], payoffsCleared: [], categories: [], changes: [] },
    ...over,
  } as Parameters<typeof insightsFor>[0]
}
const row = (over: Record<string, unknown>) => ({ id: 'r1', name: 'Lights out', bucket: 'health', memberId: 'a', count: 0, expected: 0, pct: null, ...over })
const fin = (over: Record<string, unknown>) => ({ ...base().finance, ...over })
const texts = (list: { text: string }[]) => list.map((i) => i.text)

describe('an empty month', () => {
  it('has no wins and no improvements', () => {
    expect(insightsFor(base())).toEqual({ wins: [], improve: [] })
  })
  it('never prints NaN or Infinity for zero budgets, zero expected or zero logged', () => {
    const out = insightsFor(base({ routines: [row({ expected: 0, pct: null })], health: { ...base().health, timed: [{ routineId: 'r2', name: 'x', memberId: 'a', logged: 0, onTime: 0, pct: null }] }, finance: fin({ categories: [{ category: 'dining', budget: 0, spent: 0, ratio: null }] }) }))
    expect(JSON.stringify(out)).not.toMatch(/NaN|Infinity/)
    expect(out).toEqual({ wins: [], improve: [] })
  })
})

describe('improve: routines', () => {
  it('lists a routine under 60% with the person, and not one at 60%', () => {
    const low = insightsFor(base({ routines: [row({ count: 29, expected: 49, pct: 59 })] }))
    expect(texts(low.improve)).toEqual(['Lights out (Ada) was done 59% of the time (29 of 49).'])
    expect(insightsFor(base({ routines: [row({ count: 3, expected: 5, pct: 60 })] })).improve).toEqual([])
  })
  it('names a shared routine without a person', () => {
    const out = insightsFor(base({ routines: [row({ memberId: 'shared', name: 'Grocery shopping', count: 1, expected: 3, pct: 33 })] }))
    expect(texts(out.improve)).toEqual(['Grocery shopping was done 33% of the time (1 of 3).'])
  })
  it('keeps only the weakest three routines', () => {
    const rows = [50, 10, 40, 20, 30].map((pct, i) => row({ id: `r${i}`, name: `R${i}`, count: pct, expected: 100, pct }))
    const out = insightsFor(base({ routines: rows }))
    expect(texts(out.improve).map((t) => t.split(' ')[0])).toEqual(['R1(Ada)'.replace('(Ada)', ''), 'R3', 'R4'].map((x) => x))
  })
})

describe('improve: money', () => {
  it('flags a category more than 10% over budget', () => {
    const at = (spent: number) => insightsFor(base({ finance: fin({ categories: [{ category: 'dining', budget: 100, spent, ratio: spent / 100 }] }) })).improve
    expect(at(110)).toEqual([])
    expect(texts(at(111))).toEqual(['Dining ran 11% over budget ($111 against $100).'])
  })
  it('names unpaid bills, and says "yet" while the month is still going', () => {
    const finished = insightsFor(base({ finance: fin({ billsDue: 3, billsPaid: 1, unpaid: ['Rent', 'Netflix'] }) }))
    expect(texts(finished.improve)).toContain('2 monthly bills not paid: Rent, Netflix.')
    const partial = insightsFor(base({ range: range(true), finance: fin({ billsDue: 2, billsPaid: 1, unpaid: ['Rent'] }) }))
    expect(texts(partial.improve)).toContain('1 monthly bill not paid yet.')
  })
  it('flags savings below target only for a finished month with money activity', () => {
    const f = fin({ spent: 500, savedThisMonth: 9000 })
    expect(texts(insightsFor(base({ finance: f })).improve)).toContain('Savings reached $9,000 against the $10,000 target.')
    expect(texts(insightsFor(base({ range: range(true), finance: f })).improve)).toEqual([])
    expect(insightsFor(base({ finance: fin({ savedThisMonth: 0 }) })).improve).toEqual([])
  })
})

describe('improve: the rest', () => {
  it('flags a timed routine under 70% on time', () => {
    const at = (onTime: number) => insightsFor(base({ health: { ...base().health, timed: [{ routineId: 'r2', name: 'Lights out', memberId: 'b', logged: 100, onTime, pct: onTime }] } })).improve
    expect(at(70)).toEqual([])
    expect(texts(at(69))).toEqual(['Lights out (Ben) was on time 69% of logged days.'])
  })
  it('flags weeks without a workout, but only when some workout was logged', () => {
    const weeks = ['2026-10-12', '2026-10-19']
    const withRun = { byMember: { a: { workouts: 3, minutes: 60, byType: {} }, b: { workouts: 0, minutes: 0, byType: {} } }, timed: [], weeksWithoutWorkout: weeks }
    expect(texts(insightsFor(base({ health: withRun })).improve)).toEqual(['No workout was logged in 2 weeks, starting with the week of 2026-10-12.'])
    expect(insightsFor(base({ health: { ...base().health, weeksWithoutWorkout: weeks } })).improve).toEqual([])
  })
  it('flags study milestones under half done', () => {
    const study = (a: number, total: number) => ({ ...base().study, milestones: { a: { done: a, total }, b: { done: 0, total: 0 } } })
    expect(texts(insightsFor(base({ study: study(49, 100) })).improve)).toEqual(['Study milestones: 49 of 100 done.'])
    expect(insightsFor(base({ study: study(50, 100) })).improve).toEqual([])
  })
  it('flags planned trips not done, finished month only', () => {
    expect(texts(insightsFor(base({ travel: { planned: 3, done: 1, trips: [] } })).improve)).toEqual(['2 planned trips not done.'])
    expect(texts(insightsFor(base({ travel: { planned: 2, done: 1, trips: [] } })).improve)).toEqual(['1 planned trip not done.'])
    expect(insightsFor(base({ range: range(true), travel: { planned: 3, done: 1, trips: [] } })).improve).toEqual([])
  })
})

describe('wins', () => {
  it('routines at 90% or more, not 89%', () => {
    expect(texts(insightsFor(base({ routines: [row({ count: 28, expected: 31, pct: 90 })] })).wins)).toEqual(['Lights out (Ada): 90% done. Keep it up!'])
    expect(insightsFor(base({ routines: [row({ count: 89, expected: 100, pct: 89 })] })).wins).toEqual([])
  })
  it('every bill paid, a cleared payoff and savings at target', () => {
    const out = insightsFor(base({ finance: fin({ billsDue: 2, billsPaid: 2, spent: 10, savedThisMonth: 10000, payoffsCleared: ['Card payoff', 'Loan'] }) }))
    expect(texts(out.wins)).toEqual(['Every monthly bill was paid.', 'Savings hit $10,000, at or above the $10,000 target.', 'Cleared: Card payoff, Loan.'])
  })
  it('a category more than 10% under budget, finished month only', () => {
    const at = (spent: number, partial = false) => insightsFor(base({ range: range(partial), finance: fin({ categories: [{ category: 'dining', budget: 100, spent, ratio: spent / 100 }] }) })).wins
    expect(at(90)).toEqual([])
    expect(texts(at(89))).toEqual(['Dining came in 11% under budget.'])
    expect(at(50, true)).toEqual([])
  })
  it('a streak of 7 days or more', () => {
    const streak = (a: number) => insightsFor(base({ scorecard: { ...base().scorecard, bestStreakByMember: { a, b: 3 } } })).wins
    expect(streak(6)).toEqual([])
    expect(texts(streak(7))).toEqual(['Best streak: 7 days (Ada).'])
  })
  it('a boss beaten, only when the game is given', () => {
    expect(texts(insightsFor({ ...base(), game: { bossesBeaten: 2 } }).wins)).toEqual(['Boss beaten 2 times.'])
    expect(texts(insightsFor({ ...base(), game: { bossesBeaten: 1 } }).wins)).toEqual(['Boss beaten 1 time.'])
    expect(insightsFor({ ...base(), game: { bossesBeaten: 0 } }).wins).toEqual([])
  })
})

describe('order and caps', () => {
  it('puts money first, then routines, then the rest', () => {
    const out = insightsFor(base({ routines: [row({ count: 1, expected: 4, pct: 25 })], finance: fin({ billsDue: 1, billsPaid: 0, unpaid: ['Rent'] }), travel: { planned: 2, done: 0, trips: [] } }))
    expect(texts(out.improve)).toEqual(['1 monthly bill not paid: Rent.', 'Lights out (Ada) was done 25% of the time (1 of 4).', '2 planned trips not done.'])
  })
  it('shows at most seven improvements, dropping the lowest priority', () => {
    const over = (c: string) => ({ category: c, budget: 100, spent: 200, ratio: 2 })
    const out = insightsFor(base({
      routines: [10, 20, 30].map((pct, i) => row({ id: `r${i}`, name: `R${i}`, count: pct, expected: 100, pct })),
      finance: fin({ billsDue: 1, unpaid: ['Rent'], categories: [over('dining'), over('gifts'), over('travel')] }),
      health: { ...base().health, timed: [{ routineId: 'r9', name: 'Lights out', memberId: 'a', logged: 10, onTime: 1, pct: 10 }] },
    }))
    expect(out.improve).toHaveLength(7)
    expect(texts(out.improve).join(' ')).not.toContain('on time')
  })
  it('shows at most five wins', () => {
    const out = insightsFor(base({
      routines: [95, 96, 97].map((pct, i) => row({ id: `r${i}`, name: `R${i}`, count: pct, expected: 100, pct })),
      finance: fin({ billsDue: 1, billsPaid: 1, spent: 10, savedThisMonth: 10000, payoffsCleared: ['Card payoff'] }),
    }))
    expect(out.wins).toHaveLength(5)
    expect(texts(out.wins).join(' ')).not.toContain('Cleared')
  })
})
