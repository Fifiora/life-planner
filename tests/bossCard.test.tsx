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

const read = (t: string): any[] => JSON.parse(localStorage.getItem(`lp.data.${t}`) ?? '[]')
const write = (t: string, rows: unknown[]) => localStorage.setItem(`lp.data.${t}`, JSON.stringify(rows))
const routineRow = (id: string) => ({ id, name: id, bucket: 'health', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true })
const tickRow = (routine_id: string, member_id: string, date: string) => ({ routine_id, member_id, date, done: true, value: null })

/** Everything but the last blow against this week's boss is already saved when the app opens. */
function allButTheLastBlow(boss: ReturnType<typeof bossForWeek>) {
  const week = weekStart(todayCT())
  write('routine_logs', [])
  if (boss.id === 'giant') write('activities', Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, date: week, member_id: 'a', type: 'run', minutes: 20 })))
  if (boss.id === 'sphinx') write('milestones', Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, week_start: week, member_id: 'a', text: `m${i}`, done: true })))
  if (boss.id === 'wraith') {
    write('routines', [...read('routines'), ...Array.from({ length: 9 }, (_, r) => routineRow(`br${r}`))])
    write('routine_logs', Array.from({ length: 59 }, (_, i) => ({ id: `w${i}`, ...tickRow(`br${Math.floor(i / 7)}`, 'a', addDays(week, i % 7)) })))
  }
  if (boss.id === 'twins') write('routine_logs', Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, ...tickRow('r1', i % 2 ? 'b' : 'a', addDays(week, Math.floor(i / 2))) })))
}

/** The last blow, saved the way a tap in the app saves it. */
async function lastBlow(boss: ReturnType<typeof bossForWeek>) {
  const week = weekStart(todayCT())
  await act(async () => {
    if (boss.id === 'giant') await insertRow('activities', { date: week, member_id: 'a', type: 'run', minutes: 20 })
    if (boss.id === 'sphinx') await insertRow('milestones', { week_start: week, member_id: 'a', text: 'last', done: true })
    if (boss.id === 'wraith') await insertRow('routine_logs', tickRow('br8', 'a', addDays(week, 3)))
    if (boss.id === 'twins') for (const m of ['a', 'b']) await insertRow('routine_logs', tickRow('r1', m, addDays(week, 4)))
  })
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

  it('has all four bosses in the rotation', () => {
    expect(new Set(BOSSES.map((b) => b.unit)).size).toBe(4)
  })
})

describe('boss celebration', () => {
  it('celebrates a defeated boss once', async () => {
    const boss = bossForWeek(weekStart(todayCT()))
    allButTheLastBlow(boss)
    const { unmount } = renderScreen(<Celebrations />)
    await waitFor(() => expect(localStorage.getItem('lp.seen')).not.toBeNull())
    expect(screen.queryByText(/Boss defeated/)).toBeNull()
    await lastBlow(boss)
    expect(await screen.findByText(new RegExp(`Boss defeated: ${boss.name}!`))).toBeInTheDocument()
    unmount()
    renderScreen(<Celebrations />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/Boss defeated/)).toBeNull()
  })
})
