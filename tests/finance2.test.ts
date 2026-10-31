import { describe, it, expect } from 'vitest'
import {
  billsPaidSummary,
  buildInsights,
  categoryTotals,
  flexView,
  forecast,
  payoffProgress,
  projectedSavings,
  savingsProgress,
} from '../src/lib/finance2'
import type { Bill } from '../src/types'

const rec = (id: string, name: string, amount: number, category: string): Bill => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false })
const one = (id: string, name: string, amount: number, due_month: string, paid = false): Bill => ({ id, name, amount, category: 'debt', kind: 'one_time', due_month, paid })

// Synthetic fixture: income 10000, recurring 3020, target 5000, payoffs 4000 (Nov) and 1000 (Dec).
const bills: Bill[] = [
  rec('r1', 'Rent', 2000, 'housing'),
  rec('r2', 'Power', 1000, 'utilities'),
  rec('s1', 'Netflix', 10, 'subscriptions'),
  rec('s2', 'Spotify', 10, 'subscriptions'),
  one('o1', 'Card A', 4000, '2026-11'),
  one('o2', 'Trip', 1000, '2026-12'),
]

describe('categoryTotals', () => {
  it('adds up monthly bills by category, biggest first, with share of income', () => {
    expect(categoryTotals(bills, 10000)).toEqual([
      { category: 'housing', total: 2000, count: 1, pctOfIncome: 20 },
      { category: 'utilities', total: 1000, count: 1, pctOfIncome: 10 },
      { category: 'subscriptions', total: 20, count: 2, pctOfIncome: 0.2 },
    ])
  })
  it('ignores one-time payoffs and copes with no income or no bills', () => {
    expect(categoryTotals([one('o', 'x', 5, '2026-11')], 100)).toEqual([])
    expect(categoryTotals(bills, 0).every((c) => c.pctOfIncome === 0)).toBe(true)
  })
})

describe('forecast', () => {
  it('projects each month, showing the payoff months falling short of the target', () => {
    const rows = forecast(10000, bills, 5000, '2026-11', 3)
    expect(rows.map((r) => r.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(rows.map((r) => r.available)).toEqual([2980, 5980, 6980])
    expect(rows.map((r) => r.savings)).toEqual([2980, 5000, 5000])
    expect(rows.map((r) => r.shortfall)).toEqual([2020, 0, 0])
  })
})

describe('payoffProgress', () => {
  const list = [one('o1', 'Card A', 4000, '2026-11', true), one('o2', 'Trip', 1000, '2026-12'), one('o3', 'Old', 500, '2026-10')]
  it('shows how much is cleared, what is left, who is overdue and the days to the deadline', () => {
    const p = payoffProgress(list, '2026-11-15', '2027-01-01')
    expect(p).toMatchObject({ total: 5500, paid: 4000, remaining: 1500, pct: 73, daysLeft: 47 })
    expect(p.items.map((i) => [i.bill.name, i.status])).toEqual([['Old', 'overdue'], ['Card A', 'paid'], ['Trip', 'upcoming']])
    expect(p.overdue.map((b) => b.name)).toEqual(['Old'])
  })
  it('counts as fully clear when there are no payoffs', () => {
    expect(payoffProgress([rec('r', 'Rent', 1, 'housing')], '2026-11-15', '2027-01-01')).toMatchObject({ total: 0, remaining: 0, pct: 100, items: [] })
  })
})

describe('billsPaidSummary', () => {
  it('counts the monthly bills ticked off for the month', () => {
    const payments = [{ id: 'p1', bill_id: 'r1', month: '2026-11', paid_on: '2026-11-01' }, { id: 'p2', bill_id: 'r2', month: '2026-10', paid_on: '2026-10-01' }]
    const s = billsPaidSummary(bills, payments, '2026-11')
    expect(s).toMatchObject({ paidCount: 1, totalCount: 4, paidAmount: 2000, totalAmount: 3020 })
    expect(s.unpaid.map((b) => b.id)).toEqual(['r2', 's1', 's2'])
  })
})

describe('flexView', () => {
  const expenses = [
    { id: '1', date: '2026-11-03', amount: 120, category: 'dining', note: '', member_id: 'a' },
    { id: '2', date: '2026-11-09', amount: 80, category: 'beauty', note: '', member_id: 'a' },
    { id: '3', date: '2026-11-10', amount: 300, category: 'groceries', note: '', member_id: 'a' },
    { id: '4', date: '2026-10-30', amount: 50, category: 'dining', note: '', member_id: 'a' },
  ]
  it('totals this month\'s extra spending apart from groceries', () => {
    expect(flexView(1000, expenses, '2026-11')).toEqual({
      budget: 1000,
      spent: 200,
      left: 800,
      overBy: 0,
      groceries: 300,
      byCategory: [{ category: 'dining', total: 120 }, { category: 'beauty', total: 80 }],
    })
  })
  it('says how far over budget it is', () => {
    expect(flexView(100, expenses, '2026-11')).toMatchObject({ left: -100, overBy: 100 })
  })
})

describe('projectedSavings', () => {
  it('is what is left after extra spending, capped at the target and never below zero', () => {
    expect(projectedSavings(2980, 200, 5000)).toBe(2780)
    expect(projectedSavings(5980, 200, 5000)).toBe(5000)
    expect(projectedSavings(100, 500, 5000)).toBe(0)
  })
})

describe('savingsProgress', () => {
  const entries = [
    { id: '1', month: '2026-11', amount: 3000 },
    { id: '2', month: '2026-12', amount: 5000 },
    { id: '3', month: '2027-01', amount: 2000 },
    { id: '4', month: '2026-10', amount: 999 },
  ]
  it('compares what has been put aside so far with the target so far', () => {
    expect(savingsProgress(entries, 5000, '2026-11', '2027-01')).toEqual({ savedToDate: 10000, targetToDate: 15000, thisMonth: 2000, gap: 5000, pct: 67 })
  })
  it('handles no entries', () => {
    expect(savingsProgress([], 5000, '2026-11', '2026-11')).toEqual({ savedToDate: 0, targetToDate: 5000, thisMonth: 0, gap: 5000, pct: 0 })
  })
})

describe('buildInsights', () => {
  it('writes plain-language takeaways', () => {
    const rows = forecast(10000, bills, 5000, '2026-11', 3)
    const lines = buildInsights({ rows, categories: categoryTotals(bills, 10000), payoff: payoffProgress([one('o1', 'Card A', 1500, '2026-12')], '2026-11-15', '2027-01-01'), target: 5000 })
    expect(lines.some((l) => /November 2026 is \$2,020 short of the \$5,000 savings target/.test(l))).toBe(true)
    expect(lines.some((l) => /From January 2027, \$1,980 is left each month/.test(l))).toBe(true)
    expect(lines.some((l) => /Housing is your biggest expense: \$2,000 \(20% of income\)/.test(l))).toBe(true)
    expect(lines.some((l) => /\$1,500 of payoffs still to pay, 47 days to go/.test(l))).toBe(true)
  })
})
