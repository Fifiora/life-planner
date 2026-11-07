import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { todayCT } from '../src/lib/dates'
import { shiftMonthKey } from '../src/lib/format'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const month = () => todayCT().slice(0, 7)
const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))
const setBudget = async (category: string, value: string) => {
  const input = await screen.findByLabelText(`Budget for ${category}`)
  await userEvent.clear(input)
  await userEvent.type(input, value)
  await userEvent.tab()
}
const bill = (id: string) => saved('bills').find((b) => b.id === id)

describe('Budget edits change the plan', () => {
  it('turns the category\'s bill into the new amount and leaves no separate budget behind', async () => {
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1900')
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    expect(saved('budgets').filter((b) => b.category === 'housing')).toHaveLength(0)
    expect(await screen.findByLabelText('Budget for housing')).toHaveValue('1900')
  })

  it('shows the new amount everywhere the plan is used', async () => {
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1900')
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$0 of \$4,607 planned/)).toBeInTheDocument()
    await openTab('Bills')
    const row = screen.getByRole('checkbox', { name: /rent paid/i }).closest('li') as HTMLElement
    expect(within(row).getByText('$1,900')).toBeInTheDocument()
  })

  it('keeps what was paid in earlier months, but this month\'s payment follows the new amount', async () => {
    const before = shiftMonthKey(month(), -1)
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([
      { id: 'old', bill_id: 'b1', month: before, paid_on: `${before}-02` },
      { id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT() },
      { id: 'own', bill_id: 'b1', month: shiftMonthKey(month(), -2), paid_on: `${shiftMonthKey(month(), -2)}-02`, amount: 1650 },
    ]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1900')
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    const byId = Object.fromEntries(saved('bill_payments').map((p) => [p.id, p.amount ?? null]))
    expect(byId).toEqual({ old: 1700, now: null, own: 1650 })
    const row = (await screen.findByText('Housing')).closest('tr') as HTMLElement
    expect(within(row).getByText('$1,900')).toBeInTheDocument()
  })

  it('also moves this month\'s payment that was saved with its own amount', async () => {
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT(), amount: 1700 }]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1900')
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount ?? null).toBeNull())
    const row = (await screen.findByText('Housing')).closest('tr') as HTMLElement
    expect(within(row).getAllByText('$1,900').length).toBeGreaterThan(0)
  })

  it('retyping the same number brings a stuck payment from this month back in line', async () => {
    localStorage.setItem('lp.data.bills', JSON.stringify([{ id: 'b1', name: 'Rent', amount: 1740, category: 'housing', kind: 'recurring', due_month: null, paid: false }]))
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([
      { id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT(), amount: 1700 },
      { id: 'old', bill_id: 'b1', month: shiftMonthKey(month(), -1), paid_on: `${shiftMonthKey(month(), -1)}-02`, amount: 1700 },
    ]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1740')
    await vi.waitFor(() => expect(saved('bill_payments').find((p) => p.id === 'now').amount ?? null).toBeNull())
    expect(saved('bill_payments').find((p) => p.id === 'old').amount).toBe(1700)
    expect(bill('b1').amount).toBe(1740)
    const row = (await screen.findByText('Housing')).closest('tr') as HTMLElement
    expect(within(row).getAllByText('$1,740').length).toBeGreaterThan(0)
  })

  it('leaves a payment alone when it already matches the bill', async () => {
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT() }]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1700')
    expect(saved('bill_payments')[0].amount ?? null).toBeNull()
    expect(bill('b1').amount).toBe(1700)
  })

  it('shares the change across several bills in the category', async () => {
    localStorage.setItem('lp.data.bills', JSON.stringify([
      { id: 'r', name: 'Rent', amount: 1500, category: 'housing', kind: 'recurring', due_month: null, paid: false },
      { id: 'p', name: 'Parking', amount: 500, category: 'housing', kind: 'recurring', due_month: null, paid: false },
    ]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '3000')
    await vi.waitFor(() => expect(bill('r').amount).toBe(2250))
    expect(bill('p').amount).toBe(750)
  })

  it('keeps a plain budget limit for a category that has no bills', async () => {
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('dining', '300')
    await vi.waitFor(() => expect(saved('budgets')).toHaveLength(1))
    expect(saved('budgets')[0]).toMatchObject({ category: 'dining', amount: 300 })
    expect(bill('b1').amount).toBe(1700)
  })

  it('does nothing when the number is not changed or not valid', async () => {
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1700')
    await setBudget('housing', 'abc')
    expect(bill('b1').amount).toBe(1700)
    expect(saved('budgets')).toHaveLength(0)
  })
})

describe('Changing a bill from where you pay it', () => {
  it('lets the paid-amount box also change the bill from now on', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Rent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Amount paid: Rent' })
    const input = within(dialog).getByLabelText('Amount')
    await userEvent.clear(input)
    await userEvent.type(input, '1900')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Also make Rent $1,900 from now on' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    expect(saved('bill_payments')[0].amount).toBe(1900)
  })

  it('leaves the bill alone when the box is not ticked', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Rent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Amount paid: Rent' })
    const input = within(dialog).getByLabelText('Amount')
    await userEvent.clear(input)
    await userEvent.type(input, '1900')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount).toBe(1900))
    expect(bill('b1').amount).toBe(1700)
  })

  it('protects earlier payments when a bill is edited in its own form', async () => {
    const before = shiftMonthKey(month(), -1)
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'old', bill_id: 'b1', month: before, paid_on: `${before}-02` }]))
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('button', { name: 'Rent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit bill' })
    const amount = within(dialog).getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '1800')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1800))
    expect(saved('bill_payments')[0].amount).toBe(1700)
  })
})
