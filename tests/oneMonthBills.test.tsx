import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { todayCT } from '../src/lib/dates'
import { monthLabel, shiftMonthKey } from '../src/lib/format'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const month = () => todayCT().slice(0, 7)
const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))
const bill = (id: string) => saved('bills').find((b) => b.id === id)

async function addForThisMonth(name: string, amount: string, category: string, alreadyPaid = false) {
  await userEvent.click(await screen.findByRole('button', { name: 'Add a bill for this month' }))
  const dialog = await screen.findByRole('dialog', { name: `Add a bill for ${monthLabel(month())}` })
  await userEvent.type(within(dialog).getByLabelText('Name'), name)
  await userEvent.type(within(dialog).getByLabelText('Amount'), amount)
  const cat = within(dialog).getByLabelText('Category')
  await userEvent.clear(cat)
  await userEvent.type(cat, category)
  if (alreadyPaid) await userEvent.click(within(dialog).getByLabelText('Already paid'))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
}

describe('Add a bill for this month', () => {
  it('saves a one-off bill that belongs to this month only', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await addForThisMonth('Car repair', '240', 'Transport')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.name === 'Car repair')).toBeTruthy())
    const added = saved('bills').find((b) => b.name === 'Car repair')
    expect(added).toMatchObject({ amount: 240, category: 'transport', kind: 'one_time', due_month: month(), one_off: true, paid: false })
  })

  it('lists it under the month, not among the payoffs', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await addForThisMonth('Car repair', '240', 'Transport')
    const heading = await screen.findByRole('heading', { name: `Added for ${monthLabel(month())}` })
    const section = heading.closest('section') as HTMLElement
    expect(within(section).getByText('Car repair')).toBeInTheDocument()
    const payoffs = (await screen.findByRole('heading', { name: 'One-time payoffs' })).closest('section') as HTMLElement
    expect(within(payoffs).queryByText('Car repair')).toBeNull()
    expect(within(payoffs).getByText('Card payoff')).toBeInTheDocument()
  })

  it('can be saved as already paid', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await addForThisMonth('Dinner out', '60', 'dining', true)
    await vi.waitFor(() => expect(saved('bills').find((b) => b.name === 'Dinner out')).toBeTruthy())
    expect(saved('bills').find((b) => b.name === 'Dinner out').paid).toBe(true)
  })

  it('adds to this month\'s plan', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await addForThisMonth('Car repair', '240', 'Transport')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.name === 'Car repair')).toBeTruthy())
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$0 of \$4,647 planned/)).toBeInTheDocument()
  })

  it('asks for a name and an amount', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(await screen.findByRole('button', { name: 'Add a bill for this month' }))
    const dialog = await screen.findByRole('dialog', { name: `Add a bill for ${monthLabel(month())}` })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(saved('bills')).toHaveLength(4)
  })
})

const editPlanned = async (name: string, value: string, scope: RegExp) => {
  await userEvent.click(await screen.findByRole('button', { name: `Edit planned amount for ${name}` }))
  const dialog = await screen.findByRole('dialog', { name: `Planned amount: ${name}` })
  const box = within(dialog).getByLabelText('Amount')
  await userEvent.clear(box)
  await userEvent.type(box, value)
  await userEvent.click(within(dialog).getByRole('radio', { name: scope }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
}

describe('Editing a planned amount under Bills', () => {
  it('just this month leaves the bill alone and saves the month\'s own amount', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1740', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(1))
    expect(saved('bill_months')[0]).toMatchObject({ bill_id: 'b1', month: month(), amount: 1740 })
    expect(bill('b1').amount).toBe(1700)
    const row = (await screen.findByRole('checkbox', { name: /rent paid/i })).closest('li') as HTMLElement
    expect(within(row).getByText('$1,740')).toBeInTheDocument()
  })

  it('shows up in the month\'s plan and totals', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1740', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(1))
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$0 of \$4,447 planned/)).toBeInTheDocument()
  })

  it('a ticked bill follows the month\'s amount and an explicit payment is cleared', async () => {
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT(), amount: 1700 }]))
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1740', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(1))
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount ?? null).toBeNull())
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$1,740 of \$4,447 planned/)).toBeInTheDocument()
  })

  it('typing the bill\'s own amount again takes the month\'s change away', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1740', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(1))
    await editPlanned('Rent', '1700', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(0))
    expect(bill('b1').amount).toBe(1700)
  })

  it('this month and after changes the bill, keeps earlier months as paid, and drops the month\'s own amount', async () => {
    const before = shiftMonthKey(month(), -1)
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'old', bill_id: 'b1', month: before, paid_on: `${before}-02` }]))
    localStorage.setItem('lp.data.bill_months', JSON.stringify([{ id: 'o1', bill_id: 'b1', month: month(), amount: 1650 }]))
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1900', /this month and every month after/i)
    await vi.waitFor(() => expect(bill('b1').amount).toBe(1900))
    expect(saved('bill_months')).toHaveLength(0)
    expect(saved('bill_payments').find((p) => p.id === 'old').amount).toBe(1700)
  })

  it('does not touch other months', async () => {
    localStorage.setItem('lp.data.bill_months', JSON.stringify([{ id: 'o1', bill_id: 'b1', month: shiftMonthKey(month(), 1), amount: 1500 }]))
    renderScreen(<Finance />)
    await openTab('Bills')
    await editPlanned('Rent', '1740', /just this month/i)
    await vi.waitFor(() => expect(saved('bill_months')).toHaveLength(2))
    expect(saved('bill_months').find((o) => o.id === 'o1').amount).toBe(1500)
  })

  it('asks for an amount above zero', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit planned amount for Rent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Planned amount: Rent' })
    const box = within(dialog).getByLabelText('Amount')
    await userEvent.clear(box)
    await userEvent.type(box, '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(saved('bill_months')).toHaveLength(0)
  })
})
