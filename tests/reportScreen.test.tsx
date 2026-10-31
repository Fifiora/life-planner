import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Report from '../src/screens/Report'
import { renderScreen, seedPlanner } from './seed'

const set = (table: string, rows: unknown[]) => localStorage.setItem(`lp.data.${table}`, JSON.stringify(rows))
const routine = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, bucket: 'health', sub_bucket: 'physical', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true, shared: false, ...over })
const tick = (id: string, routine_id: string, date: string, value: string | null = null) => ({ id, routine_id, member_id: 'a', date, done: true, value })
const page = (route = '/report?month=2026-11') => renderScreen(<Report today="2026-12-03" />, route)
const card = async (title: string) => (await screen.findByRole('heading', { name: title })).closest('section')!

beforeEach(() => seedPlanner())

/** A full November (the first whole month of the plan): every section has something in it. */
function seedNovember() {
  set('routines', [routine('r1', 'Walk'), routine('r2', 'Lights out', { time_rule: 'before 22:30' })])
  set('routine_logs', [tick('1', 'r1', '2026-11-01'), tick('2', 'r1', '2026-11-02'), tick('3', 'r1', '2026-11-03'), tick('4', 'r2', '2026-11-01', '22:00'), tick('5', 'r2', '2026-11-02', '23:00')])
  set('activities', [{ id: 'a1', date: '2026-11-05', member_id: 'a', type: 'run', minutes: 30 }])
  set('milestones', [{ id: 'm1', week_start: '2026-11-02', member_id: 'a', text: 't', done: true }, { id: 'm2', week_start: '2026-11-02', member_id: 'a', text: 'u', done: false }])
  set('trivia_attempts', [{ id: 't1', question_id: 'q1', member_id: 'a', chosen_index: 0, correct: true }])
  set('places', [{ id: 'p1', name: 'Austin', drive_hours: 3, rank: 1, visited: true }])
  set('trip_plans', [{ id: 'tp1', place_id: 'p1', planned_month: '2026-11', status: 'done' }, { id: 'tp2', place_id: 'zz', planned_month: '2026-11', status: 'planned' }])
  set('night_log', [{ id: 'n1', date: '2026-11-09', type: 'game', activity: 'x', snack: 'y', host_id: 'a' }, { id: 'n2', date: '2026-11-16', type: 'game', activity: 'x', snack: 'y', host_id: 'b' }])
  const ev = (id: string, date: string, done_on: string[]) => ({ id, title: id, date, time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on })
  set('events', [ev('e1', '2026-11-05', ['2026-11-05']), ev('e2', '2026-11-06', [])])
  set('expenses', [
    { id: 'x1', date: '2026-11-04', amount: 120, category: 'groceries', note: '', member_id: 'a' },
    { id: 'x2', date: '2026-11-06', amount: 150, category: 'dining', note: '', member_id: 'a' },
    { id: 'x3', date: '2026-11-07', amount: 5000, category: 'paycheck', note: '', member_id: 'a', kind: 'income' },
  ])
  const bill = (id: string, name: string, amount: number, category: string, extra: Record<string, unknown> = {}) => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false, ...extra })
  set('bills', [bill('b1', 'Rent', 1700, 'housing'), bill('b2', 'Netflix', 7, 'subscriptions'), bill('b3', 'Groceries', 500, 'food'), bill('b4', 'Card payoff', 2200, 'debt', { kind: 'one_time', due_month: '2026-11', paid: true })])
  set('bill_payments', [{ id: 'p1', bill_id: 'b1', month: '2026-11', paid_on: '2026-11-03' }])
  set('budgets', [{ id: 'bu1', category: 'dining', amount: 100 }])
  set('savings', [{ id: 's1', month: '2026-11', amount: 500 }])
  set('income', [{ id: 'i1', name: 'Combined', monthly_amount: 19200 }])
}

describe('Report screen', () => {
  it('has a heading, the month picker and a subtitle for the chosen month', async () => {
    page()
    expect(await screen.findByRole('heading', { name: 'Month-end report' })).toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Month' })
    expect(select).toHaveValue('2026-11')
    expect(within(select).getByRole('option', { name: 'November 2026 (so far)' })).toBeInTheDocument()
    expect(screen.getByText('October 2026', { selector: 'p' })).toBeInTheDocument()
  })
  it('changes month with the picker', async () => {
    page()
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Month' }), '2026-12')
    expect(await screen.findByText('December 2026 (so far)', { selector: 'p' })).toBeInTheDocument()
  })
  it('falls back to a month that is on offer', async () => {
    page('/report?month=2026-09')
    expect(await screen.findByRole('combobox', { name: 'Month' })).toHaveValue('2026-11')
  })
  it('lists each person with their ticks in the scorecard', async () => {
    set('routines', [routine('r1', 'Walk')])
    set('routine_logs', [tick('1', 'r1', '2026-11-01'), tick('2', 'r1', '2026-11-02'), tick('3', 'r1', '2026-11-03')])
    page()
    const c = await card('Scorecard')
    expect(within(c).getByText('Ada: 3 ticks (0 last month)')).toBeInTheDocument()
    expect(within(c).getByText('Ben: 0 ticks (0 last month)')).toBeInTheDocument()
  })
  it('lists routines weakest first with the counts', async () => {
    set('routines', [routine('r1', 'Walk')])
    set('routine_logs', [tick('1', 'r1', '2026-11-01')])
    page()
    const items = within(await card('Routines')).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Walk (Ben): 0 of 30 (0%)', 'Walk (Ada): 1 of 30 (3%)'])
  })
  it('says Nothing logged and never prints NaN for a month with nothing in it', async () => {
    renderScreen(<Report today="2027-03-03" />, '/report?month=2027-02')
    const health = await card('Health')
    expect(within(health).getByText('Nothing logged')).toBeInTheDocument()
    for (const title of ['Scorecard', 'Routines', 'Finance']) expect(within(await card(title)).getByText('Nothing logged')).toBeInTheDocument()
    expect(within(await card('Wins')).getByText('None this month.')).toBeInTheDocument()
    expect(within(await card('Improve next month')).getByText('None this month.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })
  it('shows a dash for a percentage that cannot be worked out', async () => {
    set('routines', [routine('r9', 'Sat walk', { applies_to: 'a', cadence: 'weekly', weekday: 6 }), routine('r1', 'Walk', { applies_to: 'a' })])
    set('routine_logs', [tick('1', 'r1', '2026-11-01')])
    renderScreen(<Report today="2026-11-03" />, '/report?month=2026-11')
    expect(await screen.findByText('Sat walk (Ada): 0 of 0 (—)')).toBeInTheDocument()
  })
  it('shows the episode title in Anime and not in Classic', async () => {
    page()
    expect(await screen.findByText('Arc 2: The Savings Push')).toBeInTheDocument()
  })
  it('has no episode title and no game lines in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    page()
    await screen.findByRole('heading', { name: 'Scorecard' })
    expect(screen.queryByText(/^Arc \d/)).toBeNull()
    expect(screen.queryByText(/Level now/)).toBeNull()
  })
})

describe('Report accessibility', () => {
  it('gives every section card a name a screen reader can use', async () => {
    page()
    for (const name of ['Scorecard', 'Improve next month', 'Next month\'s focus']) expect(await screen.findByRole('region', { name })).toBeInTheDocument()
  })
})

describe('Report sections', () => {
  beforeEach(() => seedNovember())
  it('Health: workouts and on-time rate', async () => {
    page()
    const c = await card('Health')
    expect(within(c).getByText('Ada: 1 workout, 30 minutes')).toBeInTheDocument()
    expect(within(c).getByText('Lights out (Ada): on time 50% (1 of 2 logged days)')).toBeInTheDocument()
  })
  it('Study: milestones and all-time trivia', async () => {
    page()
    const c = await card('Study')
    expect(within(c).getByText('Ada: 1 of 2 milestones')).toBeInTheDocument()
    expect(within(c).getByText('Trivia (all time): Ada 1 of 1 correct, Ben 0 of 0 correct')).toBeInTheDocument()
  })
  it('Travel: trips with places', async () => {
    page()
    const c = await card('Travel')
    expect(within(c).getByText('Trips: 1 of 2 done')).toBeInTheDocument()
    expect(within(c).getByText('Austin (done)')).toBeInTheDocument()
  })
  it('Food: groceries against the bill, and nights in', async () => {
    page()
    const c = await card('Food')
    expect(within(c).getByText('Groceries: $120 against $500')).toBeInTheDocument()
    expect(within(c).getByText('Nights in: 2 (game 2)')).toBeInTheDocument()
  })
  it('Finance: income, spending, savings, bills and an over-budget category', async () => {
    page()
    const c = await card('Finance')
    expect(within(c).getByText('Income: $5,000 logged ($19,200 planned)')).toBeInTheDocument()
    expect(within(c).getByText('Spent: $4,170')).toBeInTheDocument()
    expect(within(c).getByText('Saved: $500 against the $10,000 target')).toBeInTheDocument()
    expect(within(c).getByText('Bills paid: 1 of 3')).toBeInTheDocument()
    expect(within(c).getByText('dining: $150 against $100')).toBeInTheDocument()
  })
  it('Calendar: done and missed', async () => {
    page()
    expect(within(await card('Calendar')).getByText('Done: 1, missed: 1, still to come: 0')).toBeInTheDocument()
  })
  it('Wins and Improve next month list the rule lines', async () => {
    page()
    expect(within(await card('Improve next month')).getByText('Dining ran 50% over budget ($150 against $100).')).toBeInTheDocument()
    expect(within(await card('Improve next month')).getByText('Savings reached $500 against the $10,000 target.')).toBeInTheDocument()
    expect(within(await card('Wins')).getByText('Cleared: Card payoff.')).toBeInTheDocument()
  })
  it('Anime shows level and bosses; Classic shows neither', async () => {
    page()
    const c = await card('Scorecard')
    expect(within(c).getByText(/^Level now: \d+$/)).toBeInTheDocument()
    expect(within(c).getByText('Bosses beaten: 0')).toBeInTheDocument()
  })
})
