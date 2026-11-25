import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { billsPaidSummary } from '../src/lib/finance2'
import { money } from '../src/lib/format'
import { ledgerRows, monthActuals, paidItems } from '../src/lib/ledger'
import { financeSection, monthRange } from '../src/lib/reportSections'
import type { Bill, BillPayment, Expense } from '../src/types'
import { reportInput } from './reportFixture'
import { renderScreen, saved, seedPlanner } from './seed'

const rec = (id: string, name: string, amount: number, category: string): Bill => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false })
const pay = (bill_id: string, month: string, amount?: number): BillPayment => ({ id: `${bill_id}${month}`, bill_id, month, paid_on: `${month}-02`, ...(amount === undefined ? {} : { amount }) })
const bank = (id: string, date: string, amount: number, category: string): Expense => ({ id, date, amount, category, note: id, member_id: 'a', source: 'bank' })

const rent = rec('r1', 'Rent', 2000, 'housing')
const power = rec('r2', 'Power', 100, 'utilities')

describe('amounts with cents', () => {
  it('shows cents only when there are some', () => {
    expect(money(120)).toBe('$120')
    expect(money(119.6)).toBe('$119.60')
    expect(money(0.4)).toBe('$0.40')
    expect(money(-25.05)).toBe('-$25.05')
    expect(money(1234.5)).toBe('$1,234.50')
    expect(money(120 - 119.6)).toBe('$0.40')
    expect(money(-0.001)).toBe('$0')
  })
})

describe('a bank line no longer hides every ticked bill', () => {
  it('keeps a ticked bill when the bank shows nothing for its category', () => {
    const a = monthActuals([rent, power], [pay('r1', '2026-11'), pay('r2', '2026-11')], [bank('b', '2026-11-03', 40, 'food')], '2026-11')
    expect(a.spentByCategory).toEqual({ food: 40, housing: 2000, utilities: 100 })
  })
  it('lets bank lines stand for the bills in their own category (nothing counts twice)', () => {
    const a = monthActuals([rent, power], [pay('r1', '2026-11'), pay('r2', '2026-11')], [bank('b', '2026-11-01', 2000, 'housing')], '2026-11')
    expect(a.spentByCategory).toEqual({ housing: 2000, utilities: 100 })
  })
  it('counts only what the bank does not show when it covers part of a bill', () => {
    const items = paidItems([rent], [pay('r1', '2026-11')], [bank('b', '2026-11-01', 500, 'housing')], '2026-11')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ amount: 1500, full: 2000 })
  })
  it('lists the uncovered ticked bills in Transactions, but not the covered ones', () => {
    const rows = ledgerRows({ month: '2026-11', expenses: [bank('b', '2026-11-01', 2000, 'housing')], payments: [pay('r1', '2026-11'), pay('r2', '2026-11')], bills: [rent, power], savings: [] })
    expect(rows.filter((r) => r.kind === 'bill').map((r) => r.description)).toEqual(['Power'])
  })
  it('is unchanged with no bank lines', () => {
    expect(paidItems([rent, power], [pay('r1', '2026-11')], [], '2026-11').map((i) => i.amount)).toEqual([2000])
  })
})

describe('part-paid bills on the Today card', () => {
  it('works out what is still owed on the part-paid bills only', () => {
    const s = billsPaidSummary([rent, power], [pay('r1', '2026-11', 1500)], '2026-11')
    expect(s.partial.map((b) => b.id)).toEqual(['r1'])
    expect(s.partialToGo).toBe(500)
    expect(s.unpaid).toHaveLength(2)
  })
})

describe('the month-end report uses each month\'s own plan', () => {
  it('values last month at last month\'s planned amounts', () => {
    const october = rec('r1', 'Rent', 1800, 'housing')
    const november = rec('r1', 'Rent', 2000, 'housing')
    const input = reportInput({
      bills: [november],
      billsFor: (m) => (m === '2026-10' ? [october] : [november]),
      payments: [pay('r1', '2026-10'), pay('r1', '2026-11')],
      planStart: '2000-01-01',
    })
    const nov = financeSection(monthRange('2026-11', '2026-11-20', '2000-01-01'), input)
    expect(nov.spent).toBe(2000)
    expect(nov.changes[0]).toMatchObject({ category: 'housing', delta: 200 })
  })
})

describe('ticking "Move to savings" feeds the savings figures', () => {
  beforeEach(() => seedPlanner())
  it('adds a savings entry when ticked and removes it when unticked', async () => {
    renderScreen(<Finance />)
    const box = await screen.findByRole('checkbox', { name: /move to savings/i })
    await userEvent.click(box)
    await vi.waitFor(() => expect(saved('savings')).toHaveLength(1))
    expect(saved('savings')[0]).toMatchObject({ amount: 10000, note: 'Monthly transfer' })
    await userEvent.click(box)
    await vi.waitFor(() => expect(saved('savings')).toHaveLength(0))
  })
  it('follows the amount really sent', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('checkbox', { name: /move to savings/i }))
    await vi.waitFor(() => expect(saved('savings')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: /edit amount sent for move to savings/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Amount sent' })
    const input = within(dialog).getByLabelText('Amount')
    await userEvent.clear(input)
    await userEvent.type(input, '8000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('savings')[0].amount).toBe(8000))
  })
})
