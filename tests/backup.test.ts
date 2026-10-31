import { describe, it, expect } from 'vitest'
import { needsBackup } from '../src/lib/backup'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 20)

describe('needsBackup', () => {
  it('does not nag when there is nothing to lose', () => {
    expect(needsBackup(null, NOW, false)).toBe(false)
  })
  it('asks for a first backup once there is data', () => {
    expect(needsBackup(null, NOW, true)).toBe(true)
  })
  it('is quiet after a recent backup', () => {
    expect(needsBackup(NOW - 3 * DAY, NOW, true)).toBe(false)
  })
  it('asks again after two weeks', () => {
    expect(needsBackup(NOW - 15 * DAY, NOW, true)).toBe(true)
  })
})
