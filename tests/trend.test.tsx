import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { dailyTicks, smoothPath } from '../src/lib/trend'
import Today from '../src/screens/Today'
import { renderScreen, seedPlanner } from './seed'

const log = (id: string, routine_id: string, member_id: string, date: string, done = true) => ({ id, routine_id, member_id, date, done, value: null })

describe('dailyTicks', () => {
  it('counts each routine once per person per day, today last', () => {
    const logs = [log('1', 'r1', 'a', '2026-11-10'), log('2', 'r1', 'a', '2026-11-10'), log('3', 'r2', 'a', '2026-11-10'), log('4', 'r1', 'a', '2026-11-08'), log('5', 'r1', 'b', '2026-11-09'), log('6', 'r1', 'a', '2026-11-09', false), log('7', 'r1', 'a', '2026-10-01')]
    const t = dailyTicks(logs, ['a', 'b'], '2026-11-10', 5)
    expect(t.a).toEqual([0, 0, 1, 0, 2])
    expect(t.b).toEqual([0, 0, 0, 1, 0])
  })
})
describe('smoothPath', () => {
  it('is empty for nothing, a move for one point, and curves for more', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M1 2')
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }])).toMatch(/^M0\.0 0\.0 C.* C/)
  })
})
describe('Today dashboard pieces', () => {
  beforeEach(() => seedPlanner())
  it('shows the two gradient tiles, the momentum chart with a range, and a schedule-style Up next list', async () => {
    renderScreen(<Today />)
    await screen.findByRole('progressbar', { name: 'Done today' })
    expect(screen.getByLabelText("Today's tasks")).toBeInTheDocument()
    expect(screen.getByLabelText('All areas')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ticked .* things a day/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Range')).toHaveValue('14')
  })
})

describe('the Done today ring', () => {
  it('is drawn in one piece per task when there are a few, and still reports its percent', async () => {
    const { render } = await import('@testing-library/react')
    const { Ring } = await import('../src/ui/Ring')
    const { container } = render(<Ring label="Done today" color="var(--brand)" size={136} value={0.5} centre="2/4" segments={4} />)
    expect(container.querySelector('.prog-seg')).not.toBeNull()
    expect(container.querySelector('mask')).not.toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Done today' })).toHaveAttribute('aria-valuenow', '50')
  })
  it('is a plain ring with no segments', async () => {
    const { render } = await import('@testing-library/react')
    const { Ring } = await import('../src/ui/Ring')
    const { container } = render(<Ring label="Health" color="var(--health)" value={1} />)
    expect(container.querySelector('.prog-seg')).toBeNull()
    expect(container.querySelector('.prog-ring')).toHaveClass('full')
  })
})
