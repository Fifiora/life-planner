import { describe, it, expect } from 'vitest'
import { weekRecap } from '../src/lib/recap'
import type { RoutineLog } from '../src/types'

const log = (routine_id: string, member_id: string, date: string, done = true): RoutineLog => ({
  id: `${routine_id}-${member_id}-${date}-${done}`,
  routine_id,
  member_id,
  date,
  done,
  value: null,
})

describe('weekRecap', () => {
  it('counts what each person ticked in the last 7 days, today included', () => {
    const logs = [
      log('r1', 'm1', '2026-11-01'),
      log('r1', 'm1', '2026-11-02'),
      log('r1', 'm1', '2026-11-03'),
      log('r1', 'm1', '2026-11-04'),
      log('r1', 'm2', '2026-11-03'),
    ]
    expect(weekRecap(logs, '2026-11-04')).toEqual({ total: 5, byMember: { m1: 4, m2: 1 } })
  })
  it('ignores misses, older days and future days', () => {
    const logs = [log('r1', 'm1', '2026-11-04', false), log('r1', 'm1', '2026-10-28'), log('r1', 'm1', '2026-11-05'), log('r1', 'm1', '2026-10-29')]
    expect(weekRecap(logs, '2026-11-04')).toEqual({ total: 1, byMember: { m1: 1 } })
  })
  it('counts the same routine on the same day once per person', () => {
    const logs = [log('r1', 'm1', '2026-11-04'), log('r1', 'm1', '2026-11-04')]
    expect(weekRecap(logs, '2026-11-04').total).toBe(1)
  })
  it('is empty when nothing was ticked', () => {
    expect(weekRecap([], '2026-11-04')).toEqual({ total: 0, byMember: {} })
  })
})
