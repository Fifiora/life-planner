import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdProvider } from '../src/data/household'
import { insertRow, refresh } from '../src/data/tableStore'
import { useGame } from '../src/data/useGame'
import { todayCT } from '../src/lib/dates'
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

  it('stays silent when a lot arrives at once (an import or a first sync)', async () => {
    renderScreen(<Celebrations />)
    await ready()
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `bulk${i}`, date: todayCT(), member_id: 'a', type: 'run', minutes: 30 }))
    localStorage.setItem('lp.data.activities', JSON.stringify(rows))
    await act(async () => {
      await refresh('activities')
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/LEVEL UP|Badge unlocked/)).toBeNull()
    expect(localStorage.getItem('lp.seen')).toContain('level:a:3')
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
