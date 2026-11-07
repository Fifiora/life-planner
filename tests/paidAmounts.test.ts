import { describe, it, expect } from 'vitest'
import { billsPaidSummary, monthPaidProgress, paymentPatch, payoffPaid, payoffPatch, payoffProgress, paymentAmount } from '../src/lib/finance2'
import { categoryBreakdown, ledgerRows, monthActuals, remainingByCategory, spendShares, withRemaining } from '../src/lib/ledger'
import type { Bill, BillPayment, Expense } from '../src/types'

const rec = (id: string, name: string, amount: number, category: string): Bill => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false })
const one = (id: string, name: string, amount: number, due_month: string, over: Partial<Bill> = {}): Bill => ({ id, name, amount, category: 'debt', kind: 'one_time', due_month, paid: false, ...over })
const pay = (bill_id: string, month: string, amount?: number): BillPayment => ({ id: `${bill_id}${month}`, bill_id, month, paid_on: `${month}-02`, ...(amount === undefined ? {} : { amount }) })
const tx = (id: string, date: string, amount: number, category: string, over: Partial<Expense> = {}): Expense => ({ id, date, amount, category, note: id, member_id: 'a', ...over })

const rent = rec('r1', 'Rent', 2000, 'housing')
const power = rec('r2', 'Power', 100, 'utilities')

describe('what was actually paid', () => {
  it('uses the amount typed in, else the bill\'s own amount', () => {
    expect(paymentAmount(rent, pay('r1', '2026-11'))).toBe(2000)
    expect(paymentAmount(rent, pay('r1', '2026-11', 1500))).toBe(1500)
    expect(paymentAmount(rent, undefined)).toBe(0)
  })
  it('works out a payoff from the part paid, or all of it once cleared', () => {
    expect(payoffPaid(one('o', 'Card', 500, '2026-11'))).toBe(0)
    expect(payoffPaid(one('o', 'Card', 500, '2026-11', { paid_amount: 200 }))).toBe(200)
    expect(payoffPaid(one('o', 'Card', 500, '2026-11', { paid: true }))).toBe(500)
    expect(payoffPaid(one('o', 'Card', 500, '2026-11', { paid: true, paid_amount: 520 }))).toBe(520)
    expect(payoffPaid(one('o', 'Card', 500, '2026-11', { paid: false, paid_amount: null }))).toBe(0)
  })
})

describe('monthActuals with edited amounts', () => {
  it('counts the amount paid, not the bill\'s listed amount', () => {
    const a = monthActuals([rent, power], [pay('r1', '2026-11', 1500), pay('r2', '2026-11')], [], '2026-11')
    expect(a.spentByCategory).toEqual({ housing: 1500, utilities: 100 })
    expect(a.spent).toBe(1600)
  })
  it('counts part-paid payoffs in their due month', () => {
    const a = monthActuals([one('o1', 'Card', 500, '2026-11', { paid_amount: 200 }), one('o2', 'Trip', 800, '2026-12', { paid_amount: 100 })], [], [], '2026-11')
    expect(a.spentByCategory).toEqual({ debt: 200 })
  })
  it('still trusts bank lines over ticks', () => {
    const a = monthActuals([rent], [pay('r1', '2026-11', 1500)], [tx('b', '2026-11-01', 2000, 'housing', { source: 'bank' })], '2026-11')
    expect(a.spentByCategory).toEqual({ housing: 2000 })
  })
})

describe('what is still to pay', () => {
  const bills = [rent, power, one('o1', 'Card', 500, '2026-11', { paid_amount: 200 }), one('o2', 'Trip', 800, '2026-12')]
  it('is the planned amount minus what was paid, by category', () => {
    expect(remainingByCategory(bills, [pay('r1', '2026-11', 1500), pay('r2', '2026-11')], [], '2026-11')).toEqual({ housing: 500, debt: 300 })
  })
  it('is everything planned when nothing is paid', () => {
    expect(remainingByCategory(bills, [], [], '2026-11')).toEqual({ housing: 2000, utilities: 100, debt: 300 })
  })
  it('is empty for a month that has bank lines, so nothing is guessed', () => {
    expect(remainingByCategory(bills, [], [tx('b', '2026-11-01', 5, 'dining', { source: 'bank' })], '2026-11')).toEqual({})
  })
  it('never goes below zero when you paid more than the bill', () => {
    expect(remainingByCategory([rent], [pay('r1', '2026-11', 2500)], [], '2026-11')).toEqual({})
  })
})

describe('shares with a still-to-pay part', () => {
  it('adds the remainder to each category and brings in categories with nothing paid yet', () => {
    const shares = withRemaining(spendShares({ housing: 1500, dining: 100 }), { housing: 500, debt: 300 })
    expect(shares).toEqual([
      { category: 'housing', total: 1500, pct: 94, toGo: 500 },
      { category: 'dining', total: 100, pct: 6, toGo: 0 },
      { category: 'debt', total: 0, pct: 0, toGo: 300 },
    ])
  })
  it('shows only the remainder when nothing has been paid', () => {
    expect(withRemaining([], { housing: 2000 })).toEqual([{ category: 'housing', total: 0, pct: 0, toGo: 2000 }])
  })
})

describe('billsPaidSummary with part payments', () => {
  const bills = [rent, power, rec('r3', 'Gym', 30, 'subscriptions')]
  it('counts only fully paid bills as paid, lists part-paid ones, and adds up real money', () => {
    const s = billsPaidSummary(bills, [pay('r1', '2026-11', 1500), pay('r2', '2026-11')], '2026-11')
    expect(s).toMatchObject({ paidCount: 1, totalCount: 3, paidAmount: 1600, totalAmount: 2130, toGoAmount: 530 })
    expect(s.partial.map((b) => b.id)).toEqual(['r1'])
    expect(s.unpaid.map((b) => b.id)).toEqual(['r1', 'r3'])
  })
})

describe('monthPaidProgress', () => {
  it('covers monthly bills and the payoffs due that month', () => {
    const bills = [rent, one('o1', 'Card', 500, '2026-11', { paid_amount: 200 }), one('o2', 'Trip', 800, '2026-12')]
    expect(monthPaidProgress(bills, [pay('r1', '2026-11', 1500)], '2026-11')).toEqual({ paid: 1700, planned: 2500, toGo: 800, pct: 68 })
  })
  it('is empty and 0% when there are no bills', () => {
    expect(monthPaidProgress([], [], '2026-11')).toEqual({ paid: 0, planned: 0, toGo: 0, pct: 0 })
  })
})

describe('payoffProgress with part payments', () => {
  it('counts the part paid and marks the payoff as partly paid', () => {
    const list = [one('o1', 'Card', 1000, '2026-11', { paid_amount: 400 }), one('o2', 'Trip', 1000, '2026-12', { paid: true })]
    const p = payoffProgress(list, '2026-11-15', '2027-01-01')
    expect(p).toMatchObject({ total: 2000, paid: 1400, remaining: 600, pct: 70 })
    expect(p.items.map((i) => [i.bill.name, i.status])).toEqual([['Card', 'partial'], ['Trip', 'paid']])
  })
  it('still flags a part-paid payoff that is past due as overdue', () => {
    const p = payoffProgress([one('o1', 'Old', 1000, '2026-10', { paid_amount: 400 })], '2026-11-15', '2027-01-01')
    expect(p.overdue.map((b) => b.name)).toEqual(['Old'])
    expect(p.items[0].status).toBe('overdue')
  })
})

describe('categoryBreakdown with part payments', () => {
  it('lists what was paid with the planned amount, and what is still to pay', () => {
    const d = categoryBreakdown({ category: 'housing', bills: [rent, rec('r9', 'Parking', 50, 'housing')], payments: [pay('r1', '2026-11', 1500)], expenses: [], month: '2026-11', planned: false })
    expect(d.rows).toEqual([{ label: 'Rent', amount: 1500, kind: 'bill', of: 2000 }])
    expect(d.total).toBe(1500)
    expect(d.toGo).toEqual([{ label: 'Rent', amount: 500, kind: 'bill' }, { label: 'Parking', amount: 50, kind: 'bill' }])
    expect(d.toGoTotal).toBe(550)
  })
  it('has nothing to pay for a month with bank lines', () => {
    const d = categoryBreakdown({ category: 'housing', bills: [rent], payments: [], expenses: [tx('b', '2026-11-01', 2000, 'housing', { source: 'bank' })], month: '2026-11', planned: false })
    expect(d.toGo).toEqual([])
    expect(d.toGoTotal).toBe(0)
  })
})

describe('ledgerRows with edited amounts', () => {
  const rows = ledgerRows({
    month: '2026-11',
    expenses: [tx('e1', '2026-11-03', 120, 'dining')],
    payments: [pay('r1', '2026-11', 1500)],
    bills: [rent, one('o1', 'Card', 500, '2026-11', { paid_amount: 200 })],
    savings: [{ id: 's1', month: '2026-11', amount: 700 }],
  })
  it('shows the amount really paid', () => {
    expect(rows.find((r) => r.kind === 'bill')).toMatchObject({ amount: -1500 })
    expect(rows.find((r) => r.kind === 'payoff')).toMatchObject({ amount: -200 })
  })
  it('says which stored item each row is, and that every amount can be edited', () => {
    expect(rows.map((r) => [r.kind, r.rawId, r.amountEditable]).sort()).toEqual([
      ['bill', 'r1' + '2026-11', true],
      ['expense', 'e1', true],
      ['payoff', 'o1', true],
      ['savings', 's1', true],
    ])
  })
})

describe('what to save when an amount is typed in', () => {
  it('keeps a payment at the full bill as "no amount", and anything else as typed', () => {
    expect(paymentPatch(rent, 2000)).toEqual({ amount: null })
    expect(paymentPatch(rent, 1500)).toEqual({ amount: 1500 })
  })
  it('marks a payoff cleared once the full amount is paid, and part-paid below that', () => {
    const card = one('o', 'Card', 500, '2026-11')
    expect(payoffPatch(card, 200)).toEqual({ paid: false, paid_amount: 200 })
    expect(payoffPatch(card, 500)).toEqual({ paid: true, paid_amount: null })
    expect(payoffPatch(card, 520)).toEqual({ paid: true, paid_amount: 520 })
  })
})
