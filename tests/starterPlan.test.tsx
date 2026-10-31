import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Calendar from '../src/screens/Calendar'
import Finance from '../src/screens/Finance'
import Settings from '../src/screens/Settings'
import { getAllRows, hasPlanData, loadSnapshot, mergeMissing, resetStore } from '../src/data/tableStore'
import { startup } from '../src/data/startup'
import { StarterPlanLoader } from '../src/ui/StarterPlanLoader'
import type { PreloadFile } from '../src/lib/preload'
import { renderScreen, saved, seedPlanner } from './seed'

const file: PreloadFile = { v: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: 'AAAA', iv: 'BBBB', data: 'CCCC' }
const plain = JSON.stringify({
  v: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  tables: {
    routines: [{ id: 'sr1', name: 'Nails', bucket: 'health', sub_bucket: 'physical', cadence: 'monthly', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true, shared: false }],
    bills: [
      { id: 'sb1', name: 'Rent', amount: 1700, category: 'housing', kind: 'recurring', due_month: null, paid: false },
      { id: 'sb2', name: 'Best Buy card payoff', amount: 2200, category: 'debt', kind: 'one_time', due_month: '2026-11', paid: false },
    ],
    settings: [{ id: 'ss1', key: 'savings_target', value: '10000' }],
    members: [{ id: 'sm1', display_name: 'Stone', color: '#111' }],
  },
})
const ok = vi.fn().mockResolvedValue(plain)
const row = (over: Record<string, unknown>) => ({ id: 'x', ...over })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetStore()
  vi.restoreAllMocks()
  // Two people already entered, nothing else: the situation where the starter plan used to be missed.
  localStorage.setItem('lp.data.members', JSON.stringify([{ id: 'a', display_name: 'Ada', color: '#16a34a' }, { id: 'b', display_name: 'Ben', color: '#6366f1' }]))
  localStorage.setItem('lp.me', 'a')
})

describe('mergeMissing', () => {
  it('adds only what is not there yet and reports counts', async () => {
    localStorage.setItem('lp.data.bills', JSON.stringify([row({ id: 'b9', name: 'Mine', kind: 'recurring' })]))
    const added = await mergeMissing({ bills: [row({ id: 'b1', name: 'Rent' }), row({ id: 'b9', name: 'Mine' })], routines: [row({ id: 'r1', name: 'Walk' })] })
    expect(added).toEqual({ bills: 1, routines: 1 })
    expect(getAllRows().bills.map((b) => b.id).sort()).toEqual(['b1', 'b9'])
    expect(await mergeMissing({ bills: [row({ id: 'b1', name: 'Rent' })] })).toEqual({})
  })
  it('does not duplicate something already added by hand under the same name', async () => {
    localStorage.setItem('lp.data.bills', JSON.stringify([row({ id: 'mine', name: ' rent ' })]))
    expect(await mergeMissing({ bills: [row({ id: 'b1', name: 'Rent' })] })).toEqual({})
    localStorage.setItem('lp.data.settings', JSON.stringify([row({ id: 's', key: 'savings_target', value: '1' })]))
    resetStore()
    expect(await mergeMissing({ settings: [row({ id: 's2', key: 'savings_target', value: '10000' })] })).toEqual({})
  })
  it('keeps the names already entered on this phone', async () => {
    localStorage.setItem('lp.data.members', JSON.stringify([row({ id: 'm1', display_name: 'Ada' })]))
    expect(await mergeMissing({ members: [row({ id: 'sm1', display_name: 'Stone' })] })).toEqual({})
    expect(getAllRows().members).toHaveLength(1)
  })
  it('refuses in a view-only copy', async () => {
    loadSnapshot({})
    await expect(mergeMissing({ bills: [row({ id: 'b1', name: 'Rent' })] })).rejects.toThrow(/view-only/i)
  })
})

describe('hasPlanData', () => {
  it('is false with only names, true once there are routines, bills or income', () => {
    localStorage.setItem('lp.data.members', JSON.stringify([row({ id: 'm1' })]))
    expect(hasPlanData()).toBe(false)
    localStorage.setItem('lp.data.bills', JSON.stringify([row({ id: 'b1' })]))
    expect(hasPlanData()).toBe(true)
  })
})

describe('startup offers the preloaded plan', () => {
  const stubFetch = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => file }))
  it('even when only names were entered before', async () => {
    stubFetch()
    localStorage.setItem('lp.data.members', JSON.stringify([row({ id: 'm1' })]))
    expect((await startup('')).mode).toBe('locked')
  })
  it('not when the phone already has its own plan', async () => {
    stubFetch()
    localStorage.setItem('lp.data.routines', JSON.stringify([row({ id: 'r1' })]))
    expect((await startup('')).mode).toBe('own')
  })
})

describe('StarterPlanLoader', () => {
  it('unlocks and adds the plan, then says what was added', async () => {
    renderScreen(<StarterPlanLoader loadFile={async () => file} decrypt={ok} />)
    await userEvent.click(screen.getByRole('button', { name: 'Load our starter plan' }))
    await userEvent.type(await screen.findByLabelText('Starter plan passphrase'), 'abcd-efgh')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock and add' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/Added 1 routine, 2 bills/)
    expect(saved('bills').map((b) => b.name).sort()).toEqual(['Best Buy card payoff', 'Rent'])
  })
  it('says when everything is already here', async () => {
    seedPlanner()
    localStorage.setItem('lp.data.bills', JSON.stringify([{ id: 'sb1', name: 'Rent' }, { id: 'sb2', name: 'Best Buy card payoff' }]))
    localStorage.setItem('lp.data.routines', JSON.stringify([{ id: 'sr1', name: 'Nails' }]))
    localStorage.setItem('lp.data.settings', JSON.stringify([{ id: 'ss1', key: 'savings_target', value: '1' }]))
    resetStore()
    renderScreen(<StarterPlanLoader loadFile={async () => file} decrypt={ok} />)
    await userEvent.click(screen.getByRole('button', { name: 'Load our starter plan' }))
    await userEvent.type(await screen.findByLabelText('Starter plan passphrase'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock and add' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Everything from the starter plan is already here.')
  })
  it('shows a wrong passphrase and adds nothing', async () => {
    renderScreen(<StarterPlanLoader loadFile={async () => file} decrypt={vi.fn().mockRejectedValue(new Error("That passphrase didn't work."))} />)
    await userEvent.click(screen.getByRole('button', { name: 'Load our starter plan' }))
    await userEvent.type(await screen.findByLabelText('Starter plan passphrase'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock and add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("That passphrase didn't work.")
    expect(saved('bills')).toHaveLength(0)
  })
  it('says so when no plan is published with the site', async () => {
    renderScreen(<StarterPlanLoader loadFile={async () => null} decrypt={ok} />)
    await userEvent.click(screen.getByRole('button', { name: 'Load our starter plan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't published/i)
  })
  it('is not offered in a view-only copy', () => {
    loadSnapshot({})
    renderScreen(<StarterPlanLoader loadFile={async () => file} decrypt={ok} />)
    expect(screen.queryByRole('button', { name: 'Load our starter plan' })).toBeNull()
  })
})

describe('where the starter plan can be loaded from', () => {
  it('Settings has a Starter plan card', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByRole('heading', { name: 'Starter plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load our starter plan' })).toBeInTheDocument()
  })
  it('an empty Bills tab offers it', async () => {
    seedPlanner()
    localStorage.setItem('lp.data.bills', '[]')
    resetStore()
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Bills' }))
    expect(await screen.findByRole('button', { name: 'Load our starter plan' })).toBeInTheDocument()
  })
})

describe('Calendar payoffs banner', () => {
  const payoffs = [
    { id: 'p1', name: 'Best Buy card payoff', amount: 2200, category: 'debt', kind: 'one_time', due_month: '2026-11', paid: false },
    { id: 'p2', name: 'Credit card debt payoff', amount: 5090, category: 'debt', kind: 'one_time', due_month: '2026-11', paid: true },
    { id: 'p3', name: 'Trip spending money', amount: 2500, category: 'family', kind: 'one_time', due_month: '2026-12', paid: false },
  ]
  beforeEach(() => seedPlanner())
  it('lists the one-time payoffs due in the month on show, with paid ones marked', () => {
    localStorage.setItem('lp.data.bills', JSON.stringify(payoffs))
    resetStore()
    renderScreen(<Calendar initialDate="2026-11-05" />)
    const box = screen.getByRole('region', { name: 'Payoffs due in November 2026' })
    expect(box).toHaveTextContent('Best Buy card payoff')
    expect(box).toHaveTextContent('$2,200')
    expect(box).toHaveTextContent('Credit card debt payoff')
    expect(box).toHaveTextContent('Paid')
    expect(box).not.toHaveTextContent('Trip spending money')
    expect(screen.getByRole('link', { name: /Open in Finance/ })).toHaveAttribute('href', '/finance')
  })
  it('stays away in a month with none', () => {
    localStorage.setItem('lp.data.bills', JSON.stringify(payoffs))
    resetStore()
    renderScreen(<Calendar initialDate="2027-03-05" />)
    expect(screen.queryByRole('region', { name: /Payoffs due in/ })).toBeNull()
  })
})
