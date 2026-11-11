import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import Settings from '../src/screens/Settings'
import { EpisodeCard } from '../src/ui/EpisodeCard'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

describe('EpisodeCard', () => {
  it('shows the title, each person, the best streak and the money', async () => {
    localStorage.setItem('lp.data.routine_logs', JSON.stringify([
      { id: '1', routine_id: 'r1', member_id: 'a', date: '2026-10-28', done: true, value: null },
      { id: '2', routine_id: 'r1', member_id: 'a', date: '2026-10-29', done: true, value: null },
      { id: '3', routine_id: 'r1', member_id: 'b', date: '2026-10-29', done: true, value: null },
    ]))
    localStorage.setItem('lp.data.expenses', JSON.stringify([{ id: 'e1', date: '2026-10-30', amount: 42, category: 'food', note: '', member_id: 'a' }]))
    renderScreen(<EpisodeCard month="2026-10" />)
    expect(await screen.findByRole('heading', { name: 'Arc 1: The Fresh Start' })).toBeInTheDocument()
    expect(screen.getByText('Ada: 2 ticks')).toBeInTheDocument()
    expect(screen.getByText('Ben: 1 tick')).toBeInTheDocument()
    expect(screen.getByText('Best streak: 2 days')).toBeInTheDocument()
    expect(screen.getByText('Spent: $42')).toBeInTheDocument()
  })
})

describe('Settings episodes', () => {
  it('has an Episodes section', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByRole('heading', { name: 'Episodes' })).toBeInTheDocument()
  })
})
