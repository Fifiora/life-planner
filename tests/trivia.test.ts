import { describe, it, expect } from 'vitest'
import { gradeAnswer, scoreSummary } from '../src/lib/trivia'

describe('gradeAnswer', () => {
  it('is true for the correct option and false otherwise', () => {
    expect(gradeAnswer({ correct_index: 2 }, 2)).toBe(true)
    expect(gradeAnswer({ correct_index: 2 }, 1)).toBe(false)
  })
})

describe('scoreSummary', () => {
  it('handles no attempts without dividing by zero', () => {
    expect(scoreSummary([])).toEqual({ correct: 0, total: 0, pct: 0 })
  })
  it('rounds the percentage', () => {
    expect(scoreSummary([{ correct: true }, { correct: true }, { correct: false }])).toEqual({ correct: 2, total: 3, pct: 67 })
  })
})
