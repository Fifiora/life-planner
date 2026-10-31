import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Today from '../src/screens/Today'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { addDays, todayCT } from '../src/lib/dates'
import { renderScreen, saved, seedPlanner } from './seed'

const evRow = (over: Record<string, unknown>) => ({ id: 'e1', title: 'Thing', date: todayCT(), time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on: [], ...over })
const log = (id: string, routine_id: string, date: string) => ({ id, routine_id, member_id: 'a', date, done: true, value: null })

beforeEach(() => seedPlanner())

describe('Today week strip', () => {
  it('shows the seven days of this week with today marked', async () => {
    renderScreen(<Today />)
    const strip = await screen.findByRole('navigation', { name: 'This week' })
    const links = within(strip).getAllByRole('link')
    expect(links).toHaveLength(7)
    expect(links.filter((l) => l.getAttribute('aria-current') === 'date')).toHaveLength(1)
    links.forEach((l) => expect(l).toHaveAttribute('href', '/calendar'))
  })
})

describe('Today up next', () => {
  it('lists coming events and skips past ones', async () => {
    localStorage.setItem('lp.data.events', JSON.stringify([
      evRow({ id: 'a1', title: 'Dinner out', date: addDays(todayCT(), 1) }),
      evRow({ id: 'a2', title: 'Past thing', date: addDays(todayCT(), -1) }),
    ]))
    renderScreen(<Today />)
    const card = (await screen.findByRole('heading', { name: 'Up next' })).closest('section')!
    expect(within(card).getByText('Dinner out')).toBeInTheDocument()
    expect(within(card).queryByText('Past thing')).toBeNull()
  })
  it('stays out of the way when nothing is planned', async () => {
    renderScreen(<Today />)
    await screen.findByRole('navigation', { name: 'This week' })
    expect(screen.queryByRole('heading', { name: 'Up next' })).toBeNull()
  })
})

describe('Today progress headline', () => {
  it('counts what is done today and the streak', async () => {
    const t = todayCT()
    localStorage.setItem('lp.data.routine_logs', JSON.stringify([log('x1', 'r1', t), log('x2', 'r1', addDays(t, -1)), log('x3', 'r1', addDays(t, -2))]))
    renderScreen(<Today />)
    expect(await screen.findByText(/^1 of \d+ done today$/)).toBeInTheDocument()
    expect(screen.getByText('🔥 3-day streak')).toBeInTheDocument()
  })
})

describe('Today quick add', () => {
  it('records an expense', async () => {
    renderScreen(<Today />)
    await userEvent.click(await screen.findByRole('button', { name: 'Quick add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expense' }))
    await userEvent.type(screen.getByLabelText('Amount'), '12.5')
    await userEvent.type(screen.getByLabelText('Note'), 'Coffee')
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }))
    await waitFor(() => expect(saved('expenses').find((x) => x.note === 'Coffee')).toMatchObject({ amount: 12.5, date: todayCT(), kind: 'expense', source: 'manual', member_id: 'a' }))
  })
  it('rejects an expense without an amount', async () => {
    renderScreen(<Today />)
    await userEvent.click(await screen.findByRole('button', { name: 'Quick add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expense' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than 0.')
  })
  it('adds an event for today', async () => {
    renderScreen(<Today />)
    await userEvent.click(await screen.findByRole('button', { name: 'Quick add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Event' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Brunch')
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    await waitFor(() => expect(saved('events')[0]).toMatchObject({ title: 'Brunch', date: todayCT() }))
  })
  it('adds a shopping item', async () => {
    renderScreen(<Today />)
    await userEvent.click(await screen.findByRole('button', { name: 'Quick add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Shopping item' }))
    await userEvent.type(screen.getByLabelText('Item'), 'Milk')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    await waitFor(() => expect(saved('shopping').find((i) => i.name === 'Milk')).toMatchObject({ done: false, added_by: 'a' }))
  })
  it('is not offered in a view-only copy', async () => {
    loadSnapshot(getAllRows())
    renderScreen(<Today />)
    await screen.findByRole('navigation', { name: 'This week' })
    expect(screen.queryByRole('button', { name: 'Quick add' })).toBeNull()
  })
})
