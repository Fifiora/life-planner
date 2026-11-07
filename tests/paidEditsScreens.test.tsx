import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))
const editAmount = async (dialogName: string, value: string, field = 'Amount') => {
  const dialog = await screen.findByRole('dialog', { name: dialogName })
  const input = within(dialog).getByLabelText(field)
  await userEvent.clear(input)
  await userEvent.type(input, value)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
}

describe('Bills: amounts that mirror real life', () => {
  it('lets a ticked bill be paid for less, and the progress follows the money', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    expect(saved('bill_payments')[0].amount).toBeUndefined()
    expect(screen.getByText(/\$1,700 of \$4,407/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Rent' }))
    await editAmount('Amount paid: Rent', '1500')
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount).toBe(1500))
    expect(await screen.findByText(/\$1,500 of \$1,700/)).toBeInTheDocument()
    expect(screen.getByText(/\$200 to go/)).toBeInTheDocument()
    expect(screen.getByText(/\$1,500 of \$4,407/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /bills paid this month/i })).toHaveAttribute('aria-valuenow', '34')
  })

  it('offers no amount edit on a bill that is not paid yet', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    expect(screen.queryByRole('button', { name: 'Edit amount paid for Rent' })).toBeNull()
  })

  it('records part of a one-time payoff, then clearing it counts the rest', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Card payoff' }))
    await editAmount('Amount paid: Card payoff', '1000')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4').paid_amount).toBe(1000))
    expect(saved('bills').find((b) => b.id === 'b4').paid).toBe(false)
    expect(await screen.findByText(/partly paid/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4').paid).toBe(true))
    expect(saved('bills').find((b) => b.id === 'b4').paid_amount ?? null).toBeNull()
  })

  it('takes a payoff back to nothing paid when un-marked', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4').paid).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: 'Paid ✓' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4').paid).toBe(false))
    expect(saved('bills').find((b) => b.id === 'b4').paid_amount ?? null).toBeNull()
  })
})

describe('Overview: the chart shows paid and still to pay', () => {
  it('starts with everything still to pay, and moves money across as bills are ticked', async () => {
    renderScreen(<Finance />)
    expect(await screen.findByText(/Paid \$0 of \$4,407 planned/)).toBeInTheDocument()
    await openTab('Bills')
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$1,700 of \$4,407 planned · \$2,707 to go/)).toBeInTheDocument()
    await openTab('Bills')
    await userEvent.click(screen.getByRole('button', { name: 'Edit amount paid for Rent' }))
    await editAmount('Amount paid: Rent', '1500')
    await openTab('Overview')
    expect(await screen.findByText(/Paid \$1,500 of \$4,407 planned · \$2,907 to go/)).toBeInTheDocument()
  })
})

describe('Transactions: every amount can be corrected', () => {
  it('edits a logged expense', async () => {
    renderScreen(<Finance />)
    await openTab('Transactions')
    await userEvent.type(screen.getByLabelText('Amount'), '25')
    await userEvent.type(screen.getByLabelText('Note'), 'Dinner')
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    await vi.waitFor(() => expect(saved('expenses')).toHaveLength(1))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Dinner' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' })
    const note = within(dialog).getByLabelText('Note')
    await userEvent.clear(note)
    await userEvent.type(note, 'Dinner with Ben')
    const amount = within(dialog).getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '40')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('expenses')[0]).toMatchObject({ amount: 40, note: 'Dinner with Ben' }))
    expect(await screen.findByRole('cell', { name: 'Dinner with Ben' })).toBeInTheDocument()
  })

  it('edits what was paid on a ticked bill', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    await openTab('Transactions')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Rent' }))
    await editAmount('Edit transaction', '1500')
    await vi.waitFor(() => expect(saved('bill_payments')[0].amount).toBe(1500))
  })

  it('edits the part paid on a payoff', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4').paid).toBe(true))
    await openTab('Transactions')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Card payoff' }))
    await editAmount('Edit transaction', '1800')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b4')).toMatchObject({ paid: false, paid_amount: 1800 }))
  })
})

describe('Savings and transfers: what was sent', () => {
  it('edits a savings entry', async () => {
    renderScreen(<Finance />)
    await openTab('Savings')
    await userEvent.type(screen.getByLabelText('Amount put aside'), '700')
    await userEvent.click(screen.getByRole('button', { name: 'Add savings' }))
    await vi.waitFor(() => expect(saved('savings')).toHaveLength(1))
    await userEvent.click(await screen.findByRole('button', { name: /edit savings for/i }))
    await editAmount('Edit savings', '500')
    await vi.waitFor(() => expect(saved('savings')[0].amount).toBe(500))
  })

  it('records the amount really sent for a ticked transfer', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('checkbox', { name: /move to savings/i }))
    await vi.waitFor(() => expect(saved('checklist')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: /edit amount sent for move to savings/i }))
    await editAmount('Amount sent', '8000')
    await vi.waitFor(() => expect(saved('checklist')[0]).toMatchObject({ key: 'savings', done: true, amount: 8000 }))
    expect(await screen.findByText(/Sent \$8,000 of \$10,000/)).toBeInTheDocument()
  })

  it('offers no sent amount before a transfer is ticked', async () => {
    renderScreen(<Finance />)
    await screen.findByText('Transfers to make')
    expect(screen.queryByRole('button', { name: /edit amount sent/i })).toBeNull()
  })
})
