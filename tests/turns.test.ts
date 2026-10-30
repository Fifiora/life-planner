import { describe, it, expect } from 'vitest'
import { nextTurn } from '../src/lib/turns'

describe('nextTurn', () => {
  it('alternates between two members', () => {
    expect(nextTurn(['a', 'b'], 'a')).toBe('b')
    expect(nextTurn(['a', 'b'], 'b')).toBe('a')
  })
  it('stays on the only member', () => {
    expect(nextTurn(['a'], 'a')).toBe('a')
  })
  it('starts from the first member when the current one is unknown', () => {
    expect(nextTurn(['a', 'b'], 'zzz')).toBe('a')
  })
})
