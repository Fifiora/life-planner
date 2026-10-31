import { describe, it, expect } from 'vitest'
import { say, heroLine } from '../src/lib/voice'

describe('voice', () => {
  it('Classic keeps the plain wording the app always had', () => {
    expect(say('classic', 'encourage.empty')).toBe('Nothing is scheduled today.')
    expect(say('classic', 'encourage.all')).toBe('All done today. Nice work!')
    expect(say('classic', 'encourage.some')).toBe('Keep going, you are on a roll.')
    expect(say('classic', 'encourage.fresh')).toBe('A fresh day. Start with one thing.')
  })

  it('Anime has its own lines', () => {
    expect(say('anime', 'encourage.empty')).toBe('Quiet day. Recharge for the next episode.')
    expect(say('anime', 'encourage.all')).toBe('Cleared! Pip is doing a victory dance.')
    expect(say('anime', 'encourage.some')).toBe('Power rising! Keep the combo going.')
    expect(say('anime', 'encourage.fresh')).toBe('New episode, new chance. Land the first hit.')
  })

  it('picks the line that fits the day', () => {
    expect(heroLine('classic', 0, 0)).toBe('Nothing is scheduled today.')
    expect(heroLine('classic', 3, 3)).toBe('All done today. Nice work!')
    expect(heroLine('classic', 1, 3)).toBe('Keep going, you are on a roll.')
    expect(heroLine('classic', 0, 3)).toBe('A fresh day. Start with one thing.')
    expect(heroLine('anime', 3, 3)).toBe('Cleared! Pip is doing a victory dance.')
  })
})
