import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { loadSnapshot } from '../src/data/tableStore'
import Today from '../src/screens/Today'
import Health from '../src/screens/Health'
import Settings from '../src/screens/Settings'
import { addDays, todayCT } from '../src/lib/dates'
import { renderScreen, seedPlanner } from './seed'

const log = (id: string, routine_id: string, date: string) => ({ id, routine_id, member_id: 'a', date, done: true, value: null })
const setLogs = (rows: unknown[]) => localStorage.setItem('lp.data.routine_logs', JSON.stringify(rows))

beforeEach(() => seedPlanner())

describe('Today game layer (anime)', () => {
  it('shows my level and the party level', async () => {
    renderScreen(<Today />)
    expect(await screen.findByText(/^Ada Lv \d+$/)).toBeInTheDocument()
    expect(screen.getByText(/^Party Lv \d+$/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Ada XP' })).toBeInTheDocument()
  })

  it('counts the streak by days with anything ticked, not by one routine', async () => {
    const t = todayCT()
    setLogs([log('x1', 'r1', t), log('x2', 'r2', addDays(t, -1)), log('x3', 'r1', addDays(t, -2))])
    renderScreen(<Today />)
    expect(await screen.findByText('🔥 3-day streak')).toBeInTheDocument()
  })

  it('notes when a rest day kept the streak alive', async () => {
    const t = todayCT()
    setLogs([log('x1', 'r1', t), log('x2', 'r1', addDays(t, -2))])
    renderScreen(<Today />)
    expect(await screen.findByText('Rest day used. The streak lives on.')).toBeInTheDocument()
  })

  it('lists trophies, earned and locked', async () => {
    renderScreen(<Today />)
    expect(await screen.findByRole('heading', { name: 'Trophies' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'First Spark, earned' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Week of Fire, locked: Keep a seven-day streak.' })).toBeInTheDocument()
  })
})


describe('Bucket levels and Settings', () => {
  it('Health shows its own level', async () => {
    renderScreen(<Health />)
    expect(await screen.findByRole('img', { name: /^Health level \d+/ })).toHaveTextContent(/^Lv \d+/)
  })
  it('Settings has the trophies too', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByRole('heading', { name: 'Trophies' })).toBeInTheDocument()
  })
})

describe('a view-only copy shows none of the game layer', () => {
  const members = [{ id: 'a', display_name: 'Ada', color: '#16a34a', user_id: '' }, { id: 'b', display_name: 'Ben', color: '#6366f1', user_id: '' }]
  const routines = [{ id: 'r1', name: 'r1', bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true }]
  const snapshot = () => loadSnapshot({ members, routines, routine_logs: [log('x1', 'r1', todayCT())], cheers: [{ id: 'c1', from_member: 'b', to_member: 'a', date: todayCT() }] })

  it('Today has no levels, trophies, boss, mascot or cheers', async () => {
    snapshot()
    renderScreen(<Today />)
    await screen.findByRole('progressbar', { name: 'Done today' })
    expect(screen.queryByText(/Party Lv/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Trophies' })).toBeNull()
    expect(screen.queryByLabelText('Weekly boss')).toBeNull()
    expect(screen.queryByRole('img', { name: /^Pip/ })).toBeNull()
    expect(screen.queryByText(/cheered you on/)).toBeNull()
  })
  it('bucket screens have no level chip', async () => {
    snapshot()
    renderScreen(<Health />)
    await screen.findByRole('heading', { name: 'Health' })
    expect(screen.queryByRole('img', { name: /^Health level/ })).toBeNull()
  })
})
