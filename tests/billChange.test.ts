import { describe, it, expect } from 'vitest'
import { paymentsToPin, splitCategoryTotal } from '../src/lib/billChange'
import type { Bill, BillPayment } from '../src/types'

const rec = (id: string, amount: number): Bill => ({ id, name: id, amount, category: 'housing', kind: 'recurring', due_month: null, paid: false })
const total = (list: { amount: number }[]) => Math.round(list.reduce((s, x) => s + x.amount, 0) * 100) / 100

describe('splitCategoryTotal', () => {
  it('gives a single bill the whole new total', () => {
    expect(splitCategoryTotal([rec('rent', 1700)], 1900)).toEqual([{ id: 'rent', amount: 1900 }])
  })
  it('shares the change in proportion to each bill', () => {
    expect(splitCategoryTotal([rec('rent', 1500), rec('parking', 500)], 3000)).toEqual([{ id: 'rent', amount: 2250 }, { id: 'parking', amount: 750 }])
  })
  it('always adds up to the new total, putting odd cents on the biggest bill', () => {
    const out = splitCategoryTotal([rec('a', 10), rec('b', 10), rec('c', 10)], 100)
    expect(total(out)).toBe(100)
    expect(out.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33])
    const uneven = splitCategoryTotal([rec('a', 7), rec('b', 500)], 600.01)
    expect(total(uneven)).toBe(600.01)
  })
  it('puts the whole amount on the first bill when the bills are all zero', () => {
    expect(splitCategoryTotal([rec('a', 0), rec('b', 0)], 90)).toEqual([{ id: 'a', amount: 90 }, { id: 'b', amount: 0 }])
  })
  it('can take every bill to zero', () => {
    expect(splitCategoryTotal([rec('a', 40), rec('b', 60)], 0)).toEqual([{ id: 'a', amount: 0 }, { id: 'b', amount: 0 }])
  })
  it('has nothing to change when there are no bills', () => {
    expect(splitCategoryTotal([], 500)).toEqual([])
  })
})

describe('paymentsToPin', () => {
  const rent = rec('rent', 1700)
  const pay = (id: string, bill_id: string, month: string, amount?: number | null): BillPayment => ({ id, bill_id, month, paid_on: `${month}-02`, ...(amount === undefined ? {} : { amount }) })
  it('pins every payment of the bill that follows the bill amount, to what it was', () => {
    const out = paymentsToPin([pay('p1', 'rent', '2026-10'), pay('p2', 'rent', '2026-11', null), pay('p3', 'rent', '2026-09', 1650), pay('p4', 'other', '2026-10')], rent)
    expect(out).toEqual([{ id: 'p1', amount: 1700 }, { id: 'p2', amount: 1700 }])
  })
  it('has nothing to pin when every payment already has its own amount', () => {
    expect(paymentsToPin([pay('p3', 'rent', '2026-09', 1650)], rent)).toEqual([])
  })
})
