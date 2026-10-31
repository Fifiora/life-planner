import { describe, it, expect, beforeEach } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { insertRow } from '../src/data/tableStore'
import { BossCard } from '../src/ui/BossCard'
import { Celebrations } from '../src/ui/Celebrations'
import { BOSSES, bossForWeek } from '../src/lib/boss'
import { addDays, todayCT, weekStart } from '../src/lib/dates'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const act1 = (date: string, i: number) => ({ id: `w${i}`, date, member_id: 'a', type: 'run', minutes: 20 })
const setActivities = (dates: string[]) => localStorage.setItem('lp.data.activities', JSON.stringify(dates.map(act1)))

/** Saves enough progress this week to defeat whichever boss is on, in one go per kind of row. */
async function defeatThisWeeksBoss() {
  const week = weekStart(todayCT())
  const boss = bossForWeek(week)
  await act(async () => {
    if (boss.id === 'giant') for (let i = 0; i < 8; i++) await insertRow('activities', { date: week, member_id: 'a', type: 'run', minutes: 20 })
    if (boss.id === 'sphinx') for (let i = 0; i < 6; i++) await insertRow('milestones', { week_start: week, member_id: 'a', text: `m${i}`, done: true })
    if (boss.id === 'wraith') for (let r = 0; r < 9; r++) {
      await insertRow('routines', { id: `br${r}`, name: `br${r}`, bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true })
      for (let d = 0; d < 7; d++) await insertRow('routine_logs', { routine_id: `br${r}`, member_id: 'a', date: addDays(week, d), done: true, value: null })
    }
    if (boss.id === 'twins') for (let d = 0; d < 5; d++) for (const m of ['a', 'b']) await insertRow('routine_logs', { routine_id: 'r1', member_id: m, date: addDays(week, d), done: true, value: null })
  })
  return boss
}

describe('BossCard', () => {
  it('shows this week\'s boss and how much health it has left', async () => {
    setActivities(['2026-11-02', '2026-11-03', '2026-11-04'])
    renderScreen(<BossCard today="2026-11-04" />)
    expect(await screen.findByText('The Couch Colossus')).toBeInTheDocument()
    const hp = screen.getByRole('progressbar', { name: 'Boss HP' })
    expect(hp).toHaveAttribute('aria-valuenow', '5')
    expect(hp).toHaveAttribute('aria-valuemax', '8')
    expect(screen.getByText('3/8 workouts')).toBeInTheDocument()
    expect(screen.queryByText('Defeated!')).toBeNull()
  })

  it('says so when the boss is down', async () => {
    setActivities(Array.from({ length: 8 }, () => '2026-11-03'))
    renderScreen(<BossCard today="2026-11-04" />)
    expect(await screen.findByText('Defeated!')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Boss HP' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('is hidden in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    renderScreen(<BossCard today="2026-11-04" />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('The Couch Colossus')).toBeNull()
  })

  it('has all four bosses in the rotation', () => {
    expect(new Set(BOSSES.map((b) => b.unit)).size).toBe(4)
  })
})

describe('boss celebration', () => {
  it('celebrates a defeated boss once, and the badges for it', async () => {
    const { unmount } = renderScreen(<Celebrations />)
    await waitFor(() => expect(localStorage.getItem('lp.seen')).not.toBeNull())
    const boss = await defeatThisWeeksBoss()
    expect(await screen.findByText(new RegExp(`Boss defeated: ${boss.name}!`))).toBeInTheDocument()
    unmount()
    renderScreen(<Celebrations />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/Boss defeated/)).toBeNull()
  })
})
