import { describe, it, expect } from 'vitest'
import { daypart } from '../src/lib/daypart'

describe('daypart', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(daypart(0)).toBe('morning')
    expect(daypart(5)).toBe('morning')
    expect(daypart(11)).toBe('morning')
    expect(daypart(12)).toBe('afternoon')
    expect(daypart(17)).toBe('afternoon')
    expect(daypart(18)).toBe('evening')
    expect(daypart(23)).toBe('evening')
  })
})
