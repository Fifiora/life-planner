import { describe, it, expect } from 'vitest'
import { effectiveBills } from '../src/lib/monthBills'
import { payoffProgress } from '../src/lib/finance2'
import { monthView } from '../src/lib/finance'
import type { Bill } from '../src/types'

const rent: Bill = { id: 'b1', name: 'Rent', amount: 1700, category: 'housing', kind: 'recurring', due_month: null, paid: false }
const power: Bill = { id: 'b2', name: 'Power', amount: 90, category: 'utilities', kind: 'recurring', due_month: null, paid: false }
const payoff: Bill = { id: 'b3', name: 'Card', amount: 2200, category: 'debt', kind: 'one_time', due_month: '2026-11', paid: false }
const oneOff: Bill = { id: 'b4', name: 'Car repair', amount: 240, category: 'transport', kind: 'one_time', due_month: '2026-11', paid: false, one_off: true }

describe('a bill amount for just one month', () => {
  it('replaces the amount in that month only', () => {
    const overrides = [{ id: 'o1', bill_id: 'b1', month: '2026-11', amount: 1740 }]
    expect(effectiveBills([rent, power], overrides, '2026-11').map((b) => b.amount)).toEqual([1740, 90])
    expect(effectiveBills([rent, power], overrides, '2026-12').map((b) => b.amount)).toEqual([1700, 90])
    expect(effectiveBills([rent, power], overrides, '2026-10').map((b) => b.amount)).toEqual([1700, 90])
  })

  it('leaves the stored bills alone and returns the same list when there is nothing to change', () => {
    const bills = [rent]
    const out = effectiveBills(bills, [{ id: 'o1', bill_id: 'b1', month: '2026-11', amount: 1740 }], '2026-11')
    expect(rent.amount).toBe(1700)
    expect(out[0]).not.toBe(rent)
    expect(effectiveBills(bills, [], '2026-11')).toBe(bills)
  })

  it('only changes monthly bills', () => {
    const out = effectiveBills([payoff], [{ id: 'o1', bill_id: 'b3', month: '2026-11', amount: 1 }], '2026-11')
    expect(out[0].amount).toBe(2200)
  })

  it('feeds the month view', () => {
    const bills = effectiveBills([rent, power], [{ id: 'o1', bill_id: 'b1', month: '2026-11', amount: 1740 }], '2026-11')
    expect(monthView(5000, bills, 1000, '2026-11').recurring).toBe(1830)
  })
})

describe('one-off bills added for a month', () => {
  it('count in their own month only', () => {
    expect(monthView(5000, [rent, oneOff], 1000, '2026-11').oneTime).toBe(240)
    expect(monthView(5000, [rent, oneOff], 1000, '2026-12').oneTime).toBe(0)
  })

  it('are not payoffs, so they stay out of the payoff progress', () => {
    const p = payoffProgress([payoff, oneOff], '2026-11-08', '2027-01-01')
    expect(p.total).toBe(2200)
    expect(p.items).toHaveLength(1)
    expect(p.items[0].bill.id).toBe('b3')
  })
})
