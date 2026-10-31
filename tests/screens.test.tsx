import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import Food from '../src/screens/Food'
import Health from '../src/screens/Health'
import Settings from '../src/screens/Settings'
import Study from '../src/screens/Study'
import Today from '../src/screens/Today'
import Travel from '../src/screens/Travel'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { renderScreen, saved, seedPlanner } from './seed'

vi.mock('../src/lib/session', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/lib/session')>()), reloadApp: vi.fn() }))
import { reloadApp } from '../src/lib/session'

beforeEach(() => {
  seedPlanner()
  vi.mocked(reloadApp).mockClear()
})

describe('Finance', () => {
  it('overview shows the month, where the money goes and the debt payoff', async () => {
    renderScreen(<Finance />)
    expect(await screen.findByText('Left after bills')).toBeInTheDocument()
    expect(screen.getByText('Where the money goes')).toBeInTheDocument()
    expect(screen.getByText('Debt payoff')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
  })

  it('bills tab lets you tick off what has been paid this month', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Bills' }))
    expect(screen.getByText('Paid this month')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    expect(saved('bill_payments')[0]).toMatchObject({ bill_id: 'b1' })
  })

  it('spending tab records an extra expense', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Spending' }))
    expect(screen.getByText('Extra spending budget')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Amount'), '25')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'dining')
    await userEvent.type(screen.getByLabelText('Note'), 'Dinner')
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    await vi.waitFor(() => expect(saved('expenses')).toHaveLength(1))
    expect(saved('expenses')[0]).toMatchObject({ amount: 25, category: 'dining', note: 'Dinner', member_id: 'a' })
    expect(await screen.findByText('Dinner')).toBeInTheDocument()
  })

  it('refuses an expense with no amount', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Spending' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/amount/i)
    expect(saved('expenses')).toHaveLength(0)
  })

  it('savings tab records money put aside', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Savings' }))
    expect(screen.getByText('Put aside so far')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Amount put aside'), '3000')
    await userEvent.click(screen.getByRole('button', { name: 'Add savings' }))
    await vi.waitFor(() => expect(saved('savings')).toHaveLength(1))
    expect(saved('savings')[0]).toMatchObject({ amount: 3000 })
  })

  it('plan tab forecasts the next eight months', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Plan' }))
    expect(screen.getByText('Next 8 months')).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(9)
  })
})

describe('Health', () => {
  it('shows a monthly scorecard, sleep rhythm and an activity log', async () => {
    renderScreen(<Health />)
    expect(await screen.findByText('Monthly scorecard')).toBeInTheDocument()
    expect(screen.getByText('Sleep rhythm')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log activity' })).toBeInTheDocument()
  })

  it('logs an activity', async () => {
    renderScreen(<Health />)
    await userEvent.selectOptions(await screen.findByLabelText('Activity type'), 'run')
    await userEvent.type(screen.getByLabelText('Minutes'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Log activity' }))
    await vi.waitFor(() => expect(saved('activities')).toHaveLength(1))
    expect(saved('activities')[0]).toMatchObject({ type: 'run', minutes: 30, member_id: 'a' })
  })
})

describe('Study', () => {
  it('shows milestone history and trivia scores', async () => {
    renderScreen(<Study />)
    expect(await screen.findByText('Last 4 weeks')).toBeInTheDocument()
    expect(screen.getByText('Trivia scores')).toBeInTheDocument()
    expect(screen.getByText('Read chapter 3')).toBeInTheDocument()
  })
})

describe('Travel', () => {
  it('shows the trip rhythm with a suggestion and costs', async () => {
    renderScreen(<Travel />)
    expect(await screen.findByText('Trip rhythm')).toBeInTheDocument()
    expect(screen.getAllByText(/Austin/).length).toBeGreaterThan(0)
    expect(screen.getByText(/\$900/)).toBeInTheDocument()
  })
})

describe('Food', () => {
  it('has a shopping list you can add to and tick off, and a groceries budget', async () => {
    renderScreen(<Food />)
    expect(await screen.findByText('Shopping list')).toBeInTheDocument()
    expect(screen.getByText('Groceries budget')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Item'), 'Yam')
    await userEvent.selectOptions(screen.getByLabelText('Store'), 'African store')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    await vi.waitFor(() => expect(saved('shopping')).toHaveLength(1))
    expect(saved('shopping')[0]).toMatchObject({ name: 'Yam', store: 'African store', done: false })
    await userEvent.click(await screen.findByRole('checkbox', { name: /yam/i }))
    await vi.waitFor(() => expect(saved('shopping')[0].done).toBe(true))
  })
})

describe('Today', () => {
  it('shows the money for the month alongside the checklist', async () => {
    renderScreen(<Today />)
    expect(await screen.findByText('Money this month')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Progress' })).toBeInTheDocument()
  })
})

describe('Settings', () => {
  it('logs out: forgets who is using the phone and reloads', async () => {
    renderScreen(<Settings />)
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(localStorage.getItem('lp.me')).toBeNull()
    expect(saved('bills').length).toBeGreaterThan(0)
    expect(reloadApp).toHaveBeenCalledTimes(1)
  })

  it('erases the phone only after a second confirmation', async () => {
    renderScreen(<Settings />)
    await userEvent.click(await screen.findByRole('button', { name: 'Erase this phone' }))
    expect(saved('bills').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Yes, erase everything' }))
    expect(localStorage.getItem('lp.data.bills')).toBeNull()
    expect(reloadApp).toHaveBeenCalledTimes(1)
  })

  it('has a PIN section', async () => {
    renderScreen(<Settings />)
    const section = (await screen.findByText('App PIN')).closest('section') as HTMLElement
    expect(within(section).getByLabelText('New PIN')).toBeInTheDocument()
  })
})

describe('Today and Finance agree', () => {
  it('lowers the Finance ring when extra spending is logged', async () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('lp.data.expenses', JSON.stringify([{ id: 'e1', date: today, amount: 6000, category: 'dining', note: '', member_id: 'a' }]))
    renderScreen(<Today />)
    const ring = await screen.findByRole('progressbar', { name: 'Finance' })
    expect(ring).toHaveAttribute('aria-valuenow', '88')
  })
})

describe('Savings before the tracking start', () => {
  it('still counts money put aside earlier than the start month', async () => {
    localStorage.setItem('lp.data.savings', JSON.stringify([{ id: 's1', month: '2026-10', amount: 500 }]))
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Savings' }))
    expect(screen.getByText(/\$500 of/)).toBeInTheDocument()
  })
})

describe('Settings with a damaged PIN record', () => {
  it('offers to set a PIN rather than claiming one is on', async () => {
    localStorage.setItem('lp.pin', 'garbage')
    renderScreen(<Settings />)
    expect(await screen.findByLabelText('New PIN')).toBeInTheDocument()
  })
})

describe('view-only copy', () => {
  beforeEach(() => loadSnapshot(getAllRows()))

  it('has no income editor to reach by keyboard', async () => {
    renderScreen(<Finance />)
    await screen.findByText('Left after bills')
    expect(screen.queryByRole('button', { name: /income/i })).not.toBeInTheDocument()
  })

  it('cannot tick off a bill', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Bills' }))
    expect(screen.getByRole('checkbox', { name: /rent paid/i })).toBeDisabled()
  })

  it('cannot tick off a routine', async () => {
    renderScreen(<Health />)
    const checks = await screen.findAllByRole('button', { name: /mark daily activity done|undo daily activity/i })
    expect(checks.every((c) => (c as HTMLButtonElement).disabled)).toBe(true)
  })
})
