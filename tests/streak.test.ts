import { describe, it, expect } from 'vitest'
import { dayStreak, streakLengths } from '../src/lib/streak'

describe('dayStreak (today is Wednesday 2026-11-04)', () => {
  const today = '2026-11-04'
  it('counts consecutive days ending today', () => {
    expect(dayStreak(['2026-11-02', '2026-11-03', '2026-11-04'], today)).toEqual({ days: 3, restUsed: false })
  })
  it('forgives one empty day in a week without adding it to the count', () => {
    expect(dayStreak(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-04'], today)).toEqual({ days: 4, restUsed: true })
  })
  it('breaks after several empty days', () => {
    expect(dayStreak(['2026-10-30', '2026-10-31', '2026-11-04'], today)).toEqual({ days: 1, restUsed: false })
  })
  it('forgives only one empty day per week', () => {
    expect(dayStreak(['2026-11-02', '2026-11-04', '2026-11-06'], '2026-11-06').days).toBe(1)
  })
  it('keeps the streak alive while today is still open', () => {
    expect(dayStreak(['2026-11-02', '2026-11-03'], today)).toEqual({ days: 2, restUsed: false })
  })
  it('is zero with nothing ticked', () => {
    expect(dayStreak([], today)).toEqual({ days: 0, restUsed: false })
  })
  it('counts a repeated date once', () => {
    expect(dayStreak(['2026-11-04', '2026-11-04', '2026-11-03'], today).days).toBe(2)
  })
})

describe('streakLengths', () => {
  it('gives the streak length ending on each ticked day', () => {
    expect(streakLengths(['2026-11-03', '2026-11-02'])).toEqual({ '2026-11-02': 1, '2026-11-03': 2 })
  })
  it('is empty with no dates', () => {
    expect(streakLengths([])).toEqual({})
  })
})
