import { describe, it, expect } from 'vitest'
import { dueLabel } from '../src/lib/format'

describe('dueLabel', () => {
  it('says Today and Tomorrow in words', () => {
    expect(dueLabel('2026-11-04', '2026-11-04')).toBe('Today')
    expect(dueLabel('2026-11-05', '2026-11-04')).toBe('Tomorrow')
  })
  it('names the day and date otherwise', () => {
    expect(dueLabel('2026-11-10', '2026-11-04')).toBe('Tue, Nov 10')
  })
  it('works across a month boundary', () => {
    expect(dueLabel('2026-12-01', '2026-11-30')).toBe('Tomorrow')
  })
})
