import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hasSeen, isFirstRun, markSeen } from '../src/lib/seen'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('seen', () => {
  it('starts as a first run and remembers what was seen', () => {
    expect(isFirstRun()).toBe(true)
    expect(hasSeen('badge:a:first-spark')).toBe(false)
    markSeen('badge:a:first-spark')
    expect(isFirstRun()).toBe(false)
    expect(hasSeen('badge:a:first-spark')).toBe(true)
    expect(hasSeen('badge:a:streak-3')).toBe(false)
  })
  it('does not throw when the phone blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => markSeen('x')).not.toThrow()
    expect(hasSeen('x')).toBe(false)
  })
})
