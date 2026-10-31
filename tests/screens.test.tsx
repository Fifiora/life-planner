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
import { todayCT } from '../src/lib/dates'
import { renderScreen, saved, seedPlanner } from './seed'

vi.mock('../src/lib/session', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/lib/session')>()), reloadApp: vi.fn() }))
import { reloadApp } from '../src/lib/session'

beforeEach(() => {
  seedPlanner()
  vi.mocked(reloadApp).mockClear()
})

describe('Finance', () => {
  it('overview shows income, spend and net, where the money goes, transfers and the savings tracker', async () => {
    renderScreen(<Finance />)
    expect(await screen.findByText('Real income')).toBeInTheDocument()
    for (const label of ['Spent', 'Net', 'Moved to savings']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.getByText('Spending by category')).toBeInTheDocument()
    expect(screen.getByText('Transfers to make')).toBeInTheDocument()
    expect(screen.getByText('Savings tracker')).toBeInTheDocument()
    expect(screen.getByText('Left after bills')).toBeInTheDocument()
    expect(screen.getByText('Debt payoff')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
  })

  it('has all eight sections', async () => {
    renderScreen(<Finance />)
    for (const name of ['Overview', 'Transactions', 'Month vs Month', 'Budget', 'Bills', 'Savings', 'Plan', 'Insights']) {
      expect(await screen.findByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('transfers can be ticked off and are remembered', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('checkbox', { name: /move to savings/i }))
    await vi.waitFor(() => expect(saved('checklist')).toHaveLength(1))
    expect(saved('checklist')[0]).toMatchObject({ key: 'savings', done: true })
  })

  it('bills tab lets you tick off what has been paid this month and mark what could be cancelled', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Bills' }))
    expect(screen.getByText('Paid this month')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /rent paid/i }))
    await vi.waitFor(() => expect(saved('bill_payments')).toHaveLength(1))
    expect(saved('bill_payments')[0]).toMatchObject({ bill_id: 'b1' })
    await userEvent.selectOptions(screen.getByLabelText('Cancel status for Netflix'), 'could')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b2').cancel_status).toBe('could'))
  })

  it('transactions tab records an expense and shows it in the list', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Transactions' }))
    expect(screen.getByText('Extra spending budget')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Amount'), '25')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'dining')
    await userEvent.type(screen.getByLabelText('Note'), 'Dinner')
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    await vi.waitFor(() => expect(saved('expenses')).toHaveLength(1))
    expect(saved('expenses')[0]).toMatchObject({ amount: 25, category: 'dining', note: 'Dinner', member_id: 'a' })
    expect(await screen.findByRole('cell', { name: 'Dinner' })).toBeInTheDocument()
  })

  it('refuses an expense with no amount', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Transactions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/amount/i)
    expect(saved('expenses')).toHaveLength(0)
  })

  it('transactions can be searched', async () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('lp.data.expenses', JSON.stringify([
      { id: 'e1', date: today, amount: 20, category: 'dining', note: 'Tacos', member_id: 'a' },
      { id: 'e2', date: today, amount: 30, category: 'car', note: 'Oil change', member_id: 'a' },
    ]))
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Transactions' }))
    expect(screen.getByRole('cell', { name: 'Tacos' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Search transactions'), 'oil')
    expect(screen.queryByRole('cell', { name: 'Tacos' })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Oil change' })).toBeInTheDocument()
  })

  it('imports a bank file, categorising and skipping repeats', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Transactions' }))
    const csv = 'Date,Description,Amount\n11/03/2026,HEB #123,-54.20\n11/04/2026,Payroll ACME,2500.00\n'
    await userEvent.upload(screen.getByLabelText('Import bank CSV'), new File([csv], 'statement.csv', { type: 'text/csv' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 transactions' }))
    await vi.waitFor(() => expect(saved('expenses')).toHaveLength(2))
    expect(saved('expenses')).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: '2026-11-03', amount: 54.2, category: 'groceries', source: 'bank', kind: 'expense' }),
      expect.objectContaining({ date: '2026-11-04', amount: 2500, category: 'income', source: 'bank', kind: 'income' }),
    ]))
  })

  it('month vs month compares income and spend and trends a category', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Month vs Month' }))
    expect(screen.getByText('Income vs spend')).toBeInTheDocument()
    expect(screen.getByText('Net by month')).toBeInTheDocument()
    expect(screen.getByText('Category trend')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Housing' }))
    expect(screen.getByRole('img', { name: /housing by month/i })).toBeInTheDocument()
  })

  it('budget compares each category with its budget and lets you change it', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Budget' }))
    expect(screen.getByText('Budget vs actual')).toBeInTheDocument()
    for (const t of ['On track / under', 'Watch it', 'Over budget']) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    const input = screen.getByLabelText('Budget for housing')
    await userEvent.clear(input)
    await userEvent.type(input, '1800')
    await userEvent.tab()
    await vi.waitFor(() => expect(saved('budgets')).toHaveLength(1))
    expect(saved('budgets')[0]).toMatchObject({ category: 'housing', amount: 1800 })
  })

  it('insights tell the story in plain words', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(screen.getByText('Big picture')).toBeInTheDocument()
    expect(screen.getByText('Category callouts')).toBeInTheDocument()
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
  it('logs out: forgets who is using the phone, goes back to the start page and reloads', async () => {
    window.location.hash = '#/settings'
    renderScreen(<Settings />)
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(localStorage.getItem('lp.me')).toBeNull()
    expect(localStorage.getItem('lp.loggedout')).toBe('1')
    expect(window.location.hash).toBe('#/')
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

describe('Settings lock timing', () => {
  it('lets you choose how long the app may be away before it locks', async () => {
    localStorage.setItem('lp.pin', JSON.stringify({ v: 1, salt: 'x', hash: 'y', iterations: 1 }))
    renderScreen(<Settings />)
    await userEvent.selectOptions(await screen.findByLabelText('Lock when away'), '5')
    expect(localStorage.getItem('lp.lockAfter')).toBe('5')
  })
})

describe('Settings appearance', () => {
  it('lets you choose light, dark or the phone setting', async () => {
    renderScreen(<Settings />)
    const select = await screen.findByLabelText('Appearance')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Match my phone', 'Light', 'Dark'])
    await userEvent.selectOptions(select, 'dark')
    expect(localStorage.getItem('lp.theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

describe('Settings cycle start', () => {
  it('does not save an empty date', async () => {
    renderScreen(<Settings />)
    const input = await screen.findByLabelText(/Start of the 2-week cycle/)
    await userEvent.clear(input)
    await userEvent.click(screen.getAllByRole('button', { name: /^save/i })[0])
    const stored = saved('settings').find((r) => r.key === 'biweekly_anchor')
    expect(stored?.value ?? '2026-11-02').toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Finance overview chart share of income', () => {
  it('uses the income that was actually logged when there is some', async () => {
    localStorage.setItem('lp.data.expenses', JSON.stringify([{ id: 'inc', date: todayCT(), amount: 8500, category: 'income', note: 'Pay', member_id: 'a', kind: 'income', source: 'manual' }]))
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('button', { name: /housing/i }))
    expect(within(screen.getByRole('complementary', { name: 'Breakdown for Housing' })).getByText('20% of income')).toBeInTheDocument()
  })
})

describe('Finance overview chart', () => {
  it('shows a breakdown of a category when it is chosen', async () => {
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('button', { name: /housing/i }))
    const panel = screen.getByRole('complementary', { name: 'Breakdown for Housing' })
    expect(within(panel).getByText('Rent')).toBeInTheDocument()
    expect(within(panel).getAllByText('$1,700').length).toBeGreaterThan(0)
  })
})
