import { describe, it, expect } from 'vitest'
import { todayCT, monthKeyCT, weekStart, addDays } from '../src/lib/dates'

describe('dates', () => {
  it('uses the Chicago date when UTC is already the next day', () => {
    expect(todayCT(new Date('2026-11-01T04:30:00Z'))).toBe('2026-10-31')
  })

  it('uses the Chicago month near a month boundary', () => {
    expect(monthKeyCT(new Date('2026-12-01T03:00:00Z'))).toBe('2026-11')
  })

  it('finds the Monday that starts the week', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
  })

  it('adds days across a month boundary', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })
})
