import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { pinPayments } from '../src/data/changeBills'
import { flexView, monthPaidProgress, payoffProgress } from '../src/lib/finance2'
import { ledgerRows, monthSeries } from '../src/lib/ledger'
import type { Bill, BillPayment, Expense } from '../src/types'
import { renderScreen, saved, seedPlanner } from './seed'

const rec = (id: string, name: string, amount: number, category = 'housing'): Bill => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false })
const one = (id: string, name: string, amount: number, due_month: string, over: Partial<Bill> = {}): Bill => ({ id, name, amount, category: 'debt', kind: 'one_time', due_month, paid: false, ...over })
const pay = (bill_id: string, month: string, amount?: number): BillPayment => ({ id: `${bill_id}${month}`, bill_id, month, paid_on: `${month}-02`, ...(amount === undefined ? {} : { amount }) })
const tx = (id: string, date: string, amount: number, category: string, over: Partial<Expense> = {}): Expense => ({ id, date, amount, category, note: id, member_id: 'a', ...over })

describe('extra spending counts only real spending', () => {
  it('leaves out income and transfers, and reads "Groceries" as groceries', () => {
    const e = [
      tx('1', '2026-11-01', 3000, 'salary', { kind: 'income' }),
      tx('2', '2026-11-02', 500, 'savings', { kind: 'transfer' }),
      tx('3', '2026-11-03', 80, 'dining'),
      tx('4', '2026-11-04', 60, 'Groceries'),
    ]
    expect(flexView(1000, e, '2026-11')).toMatchObject({ spent: 80, groceries: 60 })
  })
  it('leaves out bank lines for categories the bills already cover', () => {
    const e = [tx('1', '2026-11-01', 1500, 'housing', { source: 'bank' }), tx('2', '2026-11-03', 80, 'dining', { source: 'bank' })]
    expect(flexView(1000, e, '2026-11', new Set(['housing'])).spent).toBe(80)
  })
})

describe('progress with an overpaid bill', () => {
  it('does not hide an unpaid bill behind a bigger payment', () => {
    const bills = [rec('a', 'Rent', 1000), rec('b', 'Internet', 100)]
    const p = monthPaidProgress(bills, [pay('a', '2026-11', 1100)], '2026-11')
    expect(p.paid).toBe(1100)
    expect(p.toGo).toBe(100)
    expect(p.pct).toBe(91)
  })
  it('counts an overpaid payoff only up to what it owed', () => {
    const bills = [one('a', 'A', 1000, '2026-11', { paid: true, paid_amount: 1500 }), one('b', 'B', 1000, '2026-12')]
    expect(payoffProgress(bills, '2026-11-10', '2027-01-01').pct).toBe(50)
  })
})

describe('months with their own income', () => {
  it('uses the income expected for each month', () => {
    const rows = monthSeries({
      months: ['2026-10', '2026-11'],
      actuals: [{ income: 0, spent: 0, transferOut: 0, hasBank: false, spentByCategory: {} }, { income: 0, spent: 0, transferOut: 0, hasBank: false, spentByCategory: {} }],
      income: 6000,
      bills: [],
      savings: [],
      incomeFor: (m) => (m === '2026-10' ? 4000 : 6000),
    })
    expect(rows.map((r) => r.income)).toEqual([4000, 6000])
  })
})

describe('transactions in a month with bank lines', () => {
  it('does not list ticked bills again', () => {
    const rows = ledgerRows({
      month: '2026-11',
      expenses: [tx('b1', '2026-11-01', 1500, 'housing', { source: 'bank' })],
      payments: [pay('a', '2026-11')],
      bills: [rec('a', 'Rent', 1500)],
      savings: [],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('b1')
  })
})

describe('pinning earlier payments', () => {
  it('keeps the amount that month was planned at, not the bill\'s usual one', async () => {
    const update = vi.fn(async () => undefined)
    const f = {
      payments: { rows: [pay('e', '2026-10'), pay('e', '2026-09')], update },
      monthAmounts: { rows: [{ id: 'm1', bill_id: 'e', month: '2026-10', amount: 150 }] },
    } as never
    await pinPayments(f, { ...rec('e', 'Electric', 120, 'utilities') }, '2026-11')
    expect(update).toHaveBeenCalledWith('e2026-10', { amount: 150 })
    expect(update).toHaveBeenCalledWith('e2026-09', { amount: 120 })
  })
})

describe('the Budget box', () => {
  beforeEach(() => seedPlanner())
  it('does not undo a typed paid amount when you click in and out without typing', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Bills' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Rent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Amount paid: Rent' })
    const input = within(dialog).getByLabelText('Amount')
    await userEvent.clear(input)
    await userEvent.type(input, '1750')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount).toBe(1750))

    await userEvent.click(await screen.findByRole('tab', { name: 'Budget' }))
    const box = await screen.findByLabelText('Budget for housing')
    await userEvent.click(box)
    await userEvent.tab()
    await new Promise((r) => setTimeout(r, 50))
    expect(saved('bill_payments')[0].amount).toBe(1750)
  })
})
