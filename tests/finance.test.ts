import { describe, it, expect } from 'vitest'
import { monthView, validateBill } from '../src/lib/finance'
import type { Bill } from '../src/types'

function bill(over: Partial<Bill>): Bill {
  return { id: 'b', name: 'x', amount: 0, category: 'misc', kind: 'recurring', due_month: null, paid: false, ...over }
}

// Synthetic fixture: income 10000, recurring 3000, target 5000,
// one-time 4000 due 2026-11 and 1000 due 2026-12.
const bills: Bill[] = [
  bill({ id: 'r1', name: 'Rent', amount: 2000 }),
  bill({ id: 'r2', name: 'Power', amount: 1000 }),
  bill({ id: 'o1', name: 'Card A', amount: 4000, kind: 'one_time', due_month: '2026-11' }),
  bill({ id: 'o2', name: 'Trip', amount: 1000, kind: 'one_time', due_month: '2026-12' }),
]

describe('monthView', () => {
  it('shows a shortfall in the month with a large one-time payment', () => {
    expect(monthView(10000, bills, 5000, '2026-11')).toEqual({
      recurring: 3000, oneTime: 4000, available: 3000, savings: 3000, shortfall: 2000, deficit: 0,
    })
  })
  it('meets the target when the one-time payment is smaller', () => {
    const v = monthView(10000, bills, 5000, '2026-12')
    expect(v.available).toBe(6000)
    expect(v.savings).toBe(5000)
    expect(v.shortfall).toBe(0)
  })
  it('has no one-time payments after the payoff months', () => {
    const v = monthView(10000, bills, 5000, '2027-01')
    expect(v.oneTime).toBe(0)
    expect(v.available).toBe(7000)
    expect(v.savings).toBe(5000)
  })
  it('keeps a paid one-time bill in its own month', () => {
    const paid = bills.map((b) => (b.id === 'o1' ? { ...b, paid: true } : b))
    expect(monthView(10000, paid, 5000, '2026-11')).toEqual(monthView(10000, bills, 5000, '2026-11'))
  })
  it('reports a deficit and zero savings when payments exceed income', () => {
    const big = [...bills, bill({ id: 'o3', amount: 9000, kind: 'one_time', due_month: '2026-11' })]
    const v = monthView(10000, big, 5000, '2026-11')
    expect(v.available).toBe(-6000)
    expect(v.savings).toBe(0)
    expect(v.shortfall).toBe(5000)
    expect(v.deficit).toBe(6000)
  })
})

describe('validateBill', () => {
  it('rejects a one-time bill without a due month', () => {
    expect(validateBill({ name: 'x', kind: 'one_time', amount: 10, due_month: null })).not.toBeNull()
  })
  it('rejects a negative amount', () => {
    expect(validateBill({ name: 'x', kind: 'recurring', amount: -5 })).not.toBeNull()
  })
  it('rejects an empty name', () => {
    expect(validateBill({ name: '  ', kind: 'recurring', amount: 5 })).not.toBeNull()
  })
  it('accepts a valid recurring bill and a valid one-time bill', () => {
    expect(validateBill({ name: 'Rent', kind: 'recurring', amount: 100 })).toBeNull()
    expect(validateBill({ name: 'Card', kind: 'one_time', amount: 100, due_month: '2026-11' })).toBeNull()
  })
})
