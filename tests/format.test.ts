import { describe, it, expect } from 'vitest'
import { cap, dueLabel, to12h } from '../src/lib/format'

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

describe('to12h', () => {
  it('writes times the way people say them', () => {
    expect(to12h('22:54')).toBe('10:54 pm')
    expect(to12h('04:05')).toBe('4:05 am')
    expect(to12h('00:15')).toBe('12:15 am')
    expect(to12h('12:00')).toBe('12:00 pm')
  })
})

describe('cap', () => {
  it('capitalises the first letter', () => {
    expect(cap('housing')).toBe('Housing')
    expect(cap('')).toBe('')
  })
})
