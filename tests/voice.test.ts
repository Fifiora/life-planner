import { describe, it, expect } from 'vitest'
import { say, heroLine } from '../src/lib/voice'

describe('voice', () => {
  it('uses plain, calm wording', () => {
    expect(say('encourage.empty')).toBe('Nothing is scheduled today.')
    expect(say('encourage.all')).toBe('All done today. Nice work!')
    expect(say('encourage.some')).toBe('Keep going, you are on a roll.')
    expect(say('encourage.fresh')).toBe('A fresh day. Start with one thing.')
  })

  it('picks the line that fits the day', () => {
    expect(heroLine(0, 0)).toBe('Nothing is scheduled today.')
    expect(heroLine(3, 3)).toBe('All done today. Nice work!')
    expect(heroLine(1, 3)).toBe('Keep going, you are on a roll.')
    expect(heroLine(0, 3)).toBe('A fresh day. Start with one thing.')
  })
})
