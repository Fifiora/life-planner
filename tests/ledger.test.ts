import { describe, it, expect } from 'vitest'
import {
  budgetRows,
  buildLedgerInsights,
  cancelTracker,
  categoryBreakdown,
  categoryTrend,
  filterLedger,
  ledgerRows,
  monthActuals,
  monthCallouts,
  monthKpis,
  monthSeries,
  monthWindow,
  spendShares,
  statusForRatio,
  topSpikes,
  transfersToMake,
} from '../src/lib/ledger'
import type { Bill, BillPayment, Expense, SavingsEntry } from '../src/types'
import type { MonthActuals } from '../src/lib/ledger'

const rec = (id: string, name: string, amount: number, category: string, cancel_status: Bill['cancel_status'] = ''): Bill => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false, cancel_status })
const one = (id: string, name: string, amount: number, due_month: string, paid = false): Bill => ({ id, name, amount, category: 'debt', kind: 'one_time', due_month, paid })
const tx = (id: string, date: string, amount: number, category: string, over: Partial<Expense> = {}): Expense => ({ id, date, amount, category, note: id, member_id: 'a', ...over })
const pay = (bill_id: string, month: string): BillPayment => ({ id: `${bill_id}${month}`, bill_id, month, paid_on: `${month}-02` })

const bills: Bill[] = [
  rec('r1', 'Rent', 2000, 'housing'),
  rec('r2', 'Netflix', 10, 'subscriptions', 'could'),
  rec('r3', 'Gym', 30, 'subscriptions', 'cancelled'),
  rec('r4', 'Power', 100, 'utilities'),
  one('o1', 'Card A', 500, '2026-11', true),
  one('o2', 'Trip', 800, '2026-11', false),
]

describe('monthActuals', () => {
  it('adds paid bills and logged expenses by category', () => {
    const a = monthActuals(bills, [pay('r1', '2026-11'), pay('r4', '2026-11'), pay('r2', '2026-10')], [tx('e1', '2026-11-03', 120, 'dining'), tx('e2', '2026-10-30', 50, 'dining')], '2026-11')
    expect(a.spentByCategory).toEqual({ housing: 2000, utilities: 100, dining: 120, debt: 500 })
    expect(a.spent).toBe(2720)
    expect(a.income).toBe(0)
    expect(a.hasBank).toBe(false)
  })
  it('keeps income and transfers out of spending', () => {
    const a = monthActuals([], [], [tx('i', '2026-11-01', 5000, 'income', { kind: 'income' }), tx('t', '2026-11-02', 900, 'transfer', { kind: 'transfer' }), tx('e', '2026-11-03', 40, 'Dining ')], '2026-11')
    expect(a).toMatchObject({ income: 5000, transferOut: 900, spent: 40, spentByCategory: { dining: 40 } })
  })
  it('trusts imported bank transactions over ticked-off bills, so nothing is counted twice', () => {
    const bank = tx('b1', '2026-11-01', 2000, 'housing', { source: 'bank' })
    const a = monthActuals(bills, [pay('r1', '2026-11')], [bank], '2026-11')
    expect(a.hasBank).toBe(true)
    expect(a.spentByCategory).toEqual({ housing: 2000 })
  })
  it('ignores ticks for bills that no longer exist', () => {
    expect(monthActuals(bills, [pay('gone', '2026-11')], [], '2026-11').spent).toBe(500)
  })
})

describe('monthKpis', () => {
  it('uses the configured income when none was logged', () => {
    const a = monthActuals(bills, [pay('r1', '2026-11')], [], '2026-11')
    expect(monthKpis(10000, a, 700)).toEqual({ realIncome: 10000, spent: 2500, net: 7500, transferredOut: 700 })
  })
  it('prefers logged income and adds transfers to what was put aside', () => {
    const a = monthActuals([], [], [tx('i', '2026-11-01', 8000, 'income', { kind: 'income' }), tx('t', '2026-11-02', 300, 'transfer', { kind: 'transfer' })], '2026-11')
    expect(monthKpis(10000, a, 200)).toEqual({ realIncome: 8000, spent: 0, net: 8000, transferredOut: 500 })
  })
})

describe('spendShares', () => {
  it('gives each category a share of the total, biggest first', () => {
    expect(spendShares({ housing: 750, dining: 250, tiny: 0 })).toEqual([
      { category: 'housing', total: 750, pct: 75 },
      { category: 'dining', total: 250, pct: 25 },
    ])
    expect(spendShares({})).toEqual([])
  })
})

describe('transfersToMake', () => {
  it('lists the moves to make this month, including each unpaid payoff', () => {
    const items = transfersToMake({ income: 10000, taxPct: 10, tithePct: 10, savingsTarget: 5000, payoffsDue: [one('o2', 'Trip', 800, '2026-11')] })
    expect(items.map((i) => i.key)).toEqual(['deposit', 'tax', 'tithe', 'savings', 'payoff:o2'])
    expect(items.map((i) => i.amount)).toEqual([10000, 1000, 900, 5000, 800])
  })
  it('leaves out set-asides that are switched off', () => {
    const items = transfersToMake({ income: 10000, taxPct: 0, tithePct: 0, savingsTarget: 5000, payoffsDue: [] })
    expect(items.map((i) => i.key)).toEqual(['deposit', 'savings'])
  })
})

describe('cancelTracker', () => {
  it('adds up what could be cancelled and what already was, per month and per year', () => {
    expect(cancelTracker(bills)).toEqual({ couldCancel: 10, cancelled: 30, annualPotential: 120, annualSaved: 360, couldCount: 1, cancelledCount: 1 })
  })
})

describe('statusForRatio', () => {
  it('turns spend versus budget into a label', () => {
    expect(statusForRatio(0.8).label).toBe('CRUSHED IT')
    expect(statusForRatio(1).label).toBe('ON TRACK')
    expect(statusForRatio(1.05).label).toBe('WATCH IT')
    expect(statusForRatio(1.3).label).toBe('OVER BUDGET')
  })
})

describe('budgetRows', () => {
  const months = ['2026-10', '2026-11']
  const actuals: MonthActuals[] = [
    { income: 0, spent: 0, transferOut: 0, hasBank: false, spentByCategory: {} },
    { income: 0, spent: 0, transferOut: 0, hasBank: false, spentByCategory: { housing: 2200, dining: 300 } },
  ]
  it('compares each category with its budget over the months that have activity', () => {
    const rows = budgetRows({ bills, budgets: [{ id: 'b', category: 'dining', amount: 250 }], months, actuals })
    const housing = rows.find((r) => r.category === 'housing')!
    expect(housing).toMatchObject({ budget: 2000, perMonth: [0, 2200], avg: 2200 })
    expect(housing.status.label).toBe('WATCH IT')
    const dining = rows.find((r) => r.category === 'dining')!
    expect(dining).toMatchObject({ budget: 250, avg: 300 })
    expect(dining.status.label).toBe('OVER BUDGET')
  })
  it('lets a saved budget replace the one worked out from bills', () => {
    const rows = budgetRows({ bills, budgets: [{ id: 'b', category: 'housing', amount: 2800 }], months, actuals })
    expect(rows.find((r) => r.category === 'housing')).toMatchObject({ budget: 2800 })
    expect(rows.find((r) => r.category === 'housing')!.status.label).toBe('CRUSHED IT')
  })
  it('has no status for a category with no budget', () => {
    const rows = budgetRows({ bills: [], budgets: [], months, actuals })
    expect(rows.find((r) => r.category === 'dining')!.status.label).toBe('NO BUDGET')
  })
})

describe('monthWindow', () => {
  it('lists months around the current one', () => {
    expect(monthWindow('2026-11', 2, 2)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
  })
})

describe('monthSeries', () => {
  it('gives income, spend, plan and net for each month', () => {
    const actuals = [
      monthActuals(bills, [pay('r1', '2026-10')], [], '2026-10'),
      monthActuals(bills, [pay('r1', '2026-11')], [tx('e', '2026-11-04', 100, 'dining')], '2026-11'),
    ]
    const rows = monthSeries({ months: ['2026-10', '2026-11'], actuals, income: 10000, bills, savings: [] })
    expect(rows[0]).toMatchObject({ month: '2026-10', income: 10000, spent: 2000, planned: 2140, net: 8000, hasData: true })
    expect(rows[1]).toMatchObject({ month: '2026-11', spent: 2600, planned: 3440, net: 7400 })
  })
  it('marks months with nothing recorded', () => {
    const rows = monthSeries({ months: ['2027-03'], actuals: [monthActuals([], [], [], '2027-03')], income: 10000, bills: [], savings: [] })
    expect(rows[0]).toMatchObject({ hasData: false, spent: 0 })
  })
})

describe('categoryTrend and topSpikes', () => {
  const months = ['2026-09', '2026-10', '2026-11']
  const mk = (cat: Record<string, number>) => ({ income: 0, spent: 0, transferOut: 0, hasBank: false, spentByCategory: cat })
  const actuals = [mk({ dining: 100 }), mk({ dining: 100 }), mk({ dining: 400, travel: 30 })]
  it('lists one category month by month', () => {
    expect(categoryTrend('dining', actuals)).toEqual([100, 100, 400])
    expect(categoryTrend('car', actuals)).toEqual([0, 0, 0])
  })
  it('finds categories that jumped well above their usual', () => {
    const spikes = topSpikes(months, actuals)
    expect(spikes).toEqual([{ category: 'dining', month: '2026-11', value: 400, avg: 200, pctOver: 100 }])
  })
})

describe('ledger rows', () => {
  const expenses = [
    tx('e1', '2026-11-03', 120, 'dining', { note: 'Dinner out' }),
    tx('i1', '2026-11-01', 5000, 'income', { kind: 'income', note: 'Paycheck' }),
    tx('e2', '2026-10-30', 50, 'dining'),
  ]
  const savings: SavingsEntry[] = [{ id: 's1', month: '2026-11', amount: 700 }]
  const rows = ledgerRows({ month: '2026-11', expenses, payments: [pay('r1', '2026-11')], bills, savings })

  it('combines logged items, ticked bills, savings and paid payoffs for a month', () => {
    expect(rows.map((r) => [r.kind, r.description, r.amount])).toEqual(
      expect.arrayContaining([
        ['expense', 'Dinner out', -120],
        ['income', 'Paycheck', 5000],
        ['bill', 'Rent', -2000],
        ['savings', 'Savings', -700],
        ['payoff', 'Card A', -500],
      ]),
    )
    expect(rows).toHaveLength(5)
  })
  it('only lets logged items be edited', () => {
    expect(rows.filter((r) => r.editable).map((r) => r.id).sort()).toEqual(['e1', 'i1'])
  })
  it('filters by search, kind and category, and sorts', () => {
    expect(filterLedger(rows, { search: 'rent', kind: 'all', category: 'all', sort: 'date', dir: 'asc' }).map((r) => r.description)).toEqual(['Rent'])
    expect(filterLedger(rows, { search: '', kind: 'bill', category: 'all', sort: 'date', dir: 'asc' })).toHaveLength(1)
    expect(filterLedger(rows, { search: '', kind: 'all', category: 'dining', sort: 'date', dir: 'asc' })).toHaveLength(1)
    const byAmount = filterLedger(rows, { search: '', kind: 'all', category: 'all', sort: 'amount', dir: 'desc' })
    expect(byAmount[0].description).toBe('Paycheck')
    expect(byAmount.at(-1)!.description).toBe('Rent')
  })
})


describe('monthCallouts', () => {
  const shares = [{ category: 'housing', total: 2300, pct: 79 }, { category: 'dining', total: 600, pct: 21 }]
  it('notes a positive month, the biggest line, over-budget categories and cancel potential', () => {
    const out = monthCallouts({ kpis: { realIncome: 10000, spent: 2900, net: 7100, transferredOut: 0 }, shares, budgets: { housing: 2000, dining: 500 }, couldCancelMonthly: 40 })
    expect(out.map((c) => c.tone)).toEqual(['good', 'neutral', 'warning', 'yellow'])
    expect(out[0].text).toBe('Net positive: +$7,100 this month.')
    expect(out[1].text).toBe('Biggest spending line this month: Housing at $2,300.')
    expect(out[2].text).toBe('Over budget on: Housing, Dining.')
    expect(out[3].text).toBe('Could cancel $40 a month - mark them in the Bills tab.')
  })
  it('flags a negative month and stays quiet when nothing stands out', () => {
    const out = monthCallouts({ kpis: { realIncome: 100, spent: 150, net: -50, transferredOut: 0 }, shares: [], budgets: {}, couldCancelMonthly: 0 })
    expect(out).toEqual([{ tone: 'bad', text: 'Net negative: -$50 this month.' }])
  })
})

describe('buildLedgerInsights', () => {
  const series = [
    { month: '2026-10', income: 10000, spent: 2000, planned: 2140, net: 8000, hasData: true },
    { month: '2026-11', income: 10000, spent: 2600, planned: 3440, net: 7400, hasData: true },
    { month: '2026-12', income: 10000, spent: 0, planned: 3440, net: 10000, hasData: false },
  ]
  const spikes = [{ category: 'dining', month: '2026-11', value: 400, avg: 200, pctOver: 100 }]
  it('writes the big picture, category callouts, trends and wins in sections', () => {
    const sections = buildLedgerInsights({ series, spikes, cancel: { couldCancel: 10, cancelled: 30, annualPotential: 120, annualSaved: 360, couldCount: 1, cancelledCount: 1 }, giving: { monthly: 625, pctOfIncome: 6.3 } })
    expect(sections.map((s) => s.title)).toEqual(['Big picture', 'Category callouts', 'Trends to watch', 'Big wins / big losses'])
    const text = sections.flatMap((s) => s.items.map((i) => i.text))
    expect(text).toContain('You netted +$15,400 across 2 months. Average $7,700/month kept.')
    expect(text).toContain('Your real save rate is 77%.')
    expect(text).toContain('Dining in November 2026 hit $400 — about 100% over your usual $200.')
    expect(text).toContain("$10 a month ($120 a year) is marked 'could cancel'.")
    expect(text).toContain('Already cancelled: $30 a month ($360 a year) saved.')
    expect(text).toContain('You give $625 a month (6.3% of income).')
    expect(text).toContain('October 2026 was your best month: +$8,000 net.')
  })
  it('says there is nothing to show yet when no month has data', () => {
    const sections = buildLedgerInsights({ series: [series[2]], spikes: [], cancel: { couldCancel: 0, cancelled: 0, annualPotential: 0, annualSaved: 0, couldCount: 0, cancelledCount: 0 } })
    expect(sections[0].items[0].text).toMatch(/nothing tracked yet/i)
    expect(sections[1].items[0].text).toMatch(/no major category spikes/i)
  })
})

describe('categoryBreakdown', () => {
  const b = (over: Partial<Bill>): Bill => ({ id: 'x', name: 'Item', amount: 10, category: 'other', kind: 'recurring', due_month: null, paid: false, ...over })
  const exp = (over: Partial<Expense>): Expense => ({ id: 'e', date: '2026-11-03', amount: 10, category: 'dining', note: '', member_id: 'a', kind: 'expense', source: 'manual', ...over })

  it('lists what was planned for the category when nothing was spent yet', () => {
    const bills = [
      b({ id: 'r', name: 'Rent', amount: 2000, category: 'housing' }),
      b({ id: 'p1', name: 'Best Buy payoff', amount: 2200, category: 'debt', kind: 'one_time', due_month: '2026-11' }),
      b({ id: 'p2', name: 'Later payoff', amount: 900, category: 'debt', kind: 'one_time', due_month: '2026-12' }),
    ]
    const d = categoryBreakdown({ category: 'debt', bills, payments: [], expenses: [], month: '2026-11', planned: true })
    expect(d.rows).toEqual([{ label: 'Best Buy payoff', amount: 2200, kind: 'payoff' }])
    expect(d.total).toBe(2200)
    expect(categoryBreakdown({ category: 'housing', bills, payments: [], expenses: [], month: '2026-11', planned: true }).rows).toEqual([{ label: 'Rent', amount: 2000, kind: 'bill' }])
  })

  it('lists what actually happened, biggest first, with the change from last month', () => {
    const bills = [b({ id: 'meal', name: 'Meal plan', amount: 50, category: 'dining' })]
    const payments = [{ id: 'p', bill_id: 'meal', month: '2026-11', paid_on: '2026-11-02' }]
    const expenses = [
      exp({ id: 'e1', amount: 40, note: 'Dinner' }),
      exp({ id: 'e2', amount: 60, note: '' }),
      exp({ id: 'e3', amount: 500, kind: 'income', category: 'dining' }),
      exp({ id: 'e4', amount: 30, date: '2026-10-05', note: 'Old' }),
    ]
    const d = categoryBreakdown({ category: 'dining', bills, payments, expenses, month: '2026-11', planned: false })
    expect(d.rows).toEqual([
      { label: 'Dining', amount: 60, kind: 'spent' },
      { label: 'Meal plan', amount: 50, kind: 'bill' },
      { label: 'Dinner', amount: 40, kind: 'spent' },
    ])
    expect(d.total).toBe(150)
    expect(d.previousTotal).toBe(30)
    expect(d.change).toBe(120)
  })

  it('says whether there was an earlier month to compare with', () => {
    const bills = [b({ id: 'r', name: 'Rent', amount: 2000, category: 'housing' })]
    const first = categoryBreakdown({ category: 'dining', bills, payments: [], expenses: [exp({ amount: 40 })], month: '2026-11', planned: false })
    expect(first.hasPrevious).toBe(false)
    const second = categoryBreakdown({ category: 'dining', bills, payments: [], expenses: [exp({ amount: 40 }), exp({ id: 'o', date: '2026-10-05', amount: 10 })], month: '2026-11', planned: false })
    expect(second.hasPrevious).toBe(true)
    expect(categoryBreakdown({ category: 'housing', bills, payments: [], expenses: [], month: '2026-11', planned: true }).hasPrevious).toBe(true)
  })

  it('does not count paid bills again once bank transactions exist', () => {
    const bills = [b({ id: 'meal', name: 'Meal plan', amount: 50, category: 'dining' })]
    const payments = [{ id: 'p', bill_id: 'meal', month: '2026-11', paid_on: '2026-11-02' }]
    const expenses = [exp({ id: 'e1', amount: 40, note: 'Dinner', source: 'bank' })]
    const d = categoryBreakdown({ category: 'dining', bills, payments, expenses, month: '2026-11', planned: false })
    expect(d.rows.map((r) => r.label)).toEqual(['Dinner'])
  })
})
