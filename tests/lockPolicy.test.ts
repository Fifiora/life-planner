import { describe, it, expect } from 'vitest'
import { shouldLock } from '../src/lib/lockPolicy'

const MIN = 60_000

describe('shouldLock', () => {
  it('locks straight away when set to lock immediately', () => {
    expect(shouldLock(1000, 1000, 0)).toBe(true)
  })
  it('locks once the app has been away at least the chosen time', () => {
    expect(shouldLock(0, 59 * 1000, 1)).toBe(false)
    expect(shouldLock(0, MIN, 1)).toBe(true)
    expect(shouldLock(0, 4 * MIN, 5)).toBe(false)
    expect(shouldLock(0, 5 * MIN, 5)).toBe(true)
  })
  it('never locks by time when set to never', () => {
    expect(shouldLock(0, 10 * 60 * MIN, -1)).toBe(false)
  })
})
