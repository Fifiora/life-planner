import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadSnapshot } from '../src/data/tableStore'
import { todayCT } from '../src/lib/dates'
import { CheerCard } from '../src/ui/CheerCard'
import { renderScreen, saved, seedPlanner } from './seed'

const log = (id: string, member_id: string, date: string) => ({ id, routine_id: 'r1', member_id, date, done: true, value: null })
const setLogs = (rows: unknown[]) => localStorage.setItem('lp.data.routine_logs', JSON.stringify(rows))

beforeEach(() => seedPlanner())

describe('CheerCard', () => {
  it('offers a cheer once the partner has ticked something today, and sends one only once', async () => {
    setLogs([log('p1', 'b', todayCT())])
    const { unmount } = renderScreen(<CheerCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cheer Ben' }))
    expect(saved('cheers')).toHaveLength(1)
    expect(saved('cheers')[0]).toMatchObject({ from_member: 'a', to_member: 'b', date: todayCT() })
    expect(await screen.findByText('Cheer sent')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cheer Ben' })).toBeNull()
    unmount()
    renderScreen(<CheerCard />)
    expect(await screen.findByText('Cheer sent')).toBeInTheDocument()
    expect(saved('cheers')).toHaveLength(1)
  })

  it('offers nothing when the partner has not ticked anything today', async () => {
    setLogs([log('p1', 'a', todayCT())])
    renderScreen(<CheerCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Cheer Ben' })).toBeNull()
  })

  it('shows a cheer sent to me today', async () => {
    localStorage.setItem('lp.data.cheers', JSON.stringify([{ id: 'c1', from_member: 'b', to_member: 'a', date: todayCT() }]))
    renderScreen(<CheerCard />)
    expect(await screen.findByText('Ben cheered you on today!')).toBeInTheDocument()
  })

  it('ignores an old cheer', async () => {
    localStorage.setItem('lp.data.cheers', JSON.stringify([{ id: 'c1', from_member: 'b', to_member: 'a', date: '2020-01-01' }]))
    renderScreen(<CheerCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/cheered you on/)).toBeNull()
  })

  it('shows nothing in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    setLogs([log('p1', 'b', todayCT())])
    renderScreen(<CheerCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Cheer Ben' })).toBeNull()
  })

  it('cannot send a cheer from a view-only copy', async () => {
    const members = [{ id: 'a', display_name: 'Ada', color: '#16a34a', user_id: '' }, { id: 'b', display_name: 'Ben', color: '#6366f1', user_id: '' }]
    loadSnapshot({ members, routines: [{ id: 'r1', name: 'r1', bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true }], routine_logs: [log('p1', 'b', todayCT())] })
    renderScreen(<CheerCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: /^Cheer/ })).toBeNull()
  })
})
