import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdProvider } from '../src/data/household'
import { insertRow, refresh } from '../src/data/tableStore'
import { useGame } from '../src/data/useGame'
import { addDays, todayCT, weekStart } from '../src/lib/dates'
import { Celebrations } from '../src/ui/Celebrations'
import { ToastProvider } from '../src/ui/Toast'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const addRuns = (n: number) =>
  act(async () => {
    for (let i = 0; i < n; i++) await insertRow('activities', { date: todayCT(), member_id: 'a', type: 'run', minutes: 30 })
  })
const ready = () => waitFor(() => expect(localStorage.getItem('lp.seen')).not.toBeNull())

describe('useGame', () => {
  it('gives levels and progress for a seeded planner', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <ToastProvider>
          <HouseholdProvider>{children}</HouseholdProvider>
        </ToastProvider>
      </MemoryRouter>
    )
    const { result } = renderHook(() => useGame(), { wrapper })
    await waitFor(() => expect(result.current.on).toBe(true))
    expect(result.current.me.level).toBeGreaterThanOrEqual(1)
    expect(result.current.me.progress.needed).toBeGreaterThan(0)
    expect(result.current.party.level).toBeGreaterThanOrEqual(1)
    expect(result.current.me.badges).toContain('first-spark')
  })
})

describe('useGame sharing', () => {
  it('shares one calculation between components', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <ToastProvider>
          <HouseholdProvider>{children}</HouseholdProvider>
        </ToastProvider>
      </MemoryRouter>
    )
    const { result } = renderHook(() => ({ a: useGame(), b: useGame() }), { wrapper })
    await waitFor(() => expect(result.current.a.on).toBe(true))
    expect(result.current.a).toBe(result.current.b)
  })
})

describe('Celebrations', () => {
  it('stays quiet on the first load, even with progress already made', async () => {
    renderScreen(<Celebrations />)
    await ready()
    expect(screen.queryByText(/LEVEL UP|Badge unlocked/)).toBeNull()
  })

  it('celebrates a new level and a new badge once', async () => {
    const { unmount } = renderScreen(<Celebrations />)
    await ready()
    await addRuns(1)
    expect(await screen.findByText(/Badge unlocked: First Sweat/)).toBeInTheDocument()
    await addRuns(7)
    expect(await screen.findByText(/LEVEL UP! You reached level 2!/)).toBeInTheDocument()
    unmount()
    renderScreen(<Celebrations />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/LEVEL UP|Badge unlocked/)).toBeNull()
  })

  it('sums up a lot arriving at once with only the highest level', async () => {
    renderScreen(<Celebrations />)
    await ready()
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `bulk${i}`, date: todayCT(), member_id: 'a', type: 'run', minutes: 30 }))
    localStorage.setItem('lp.data.activities', JSON.stringify(rows))
    await act(async () => {
      await refresh('activities')
    })
    expect(await screen.findByText(/LEVEL UP! You reached level 3!/)).toBeInTheDocument()
    expect(screen.queryByText(/level 2!/)).toBeNull()
    expect(localStorage.getItem('lp.seen')).toContain('level:a:2')
    expect(localStorage.getItem('lp.seen')).toContain('level:a:3')
  })

  it('tucks the extras into an "and more" line instead of going quiet', async () => {
    renderScreen(<Celebrations />)
    await ready()
    const lastWeek = addDays(weekStart(todayCT()), -7)
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `wk${i}`, routine_id: 'r1', member_id: 'a', date: addDays(lastWeek, i), done: true, value: null }))
    localStorage.setItem('lp.data.routine_logs', JSON.stringify(rows))
    await act(async () => {
      await refresh('routine_logs')
    })
    expect(await screen.findByText(/and \d+ more!/)).toBeInTheDocument()
    expect(localStorage.getItem('lp.seen')).toContain('badge:a:streak-7')
  })

  it('says nothing in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    renderScreen(<Celebrations />)
    await new Promise((r) => setTimeout(r, 50))
    await addRuns(8)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/LEVEL UP|Badge unlocked/)).toBeNull()
  })
})
