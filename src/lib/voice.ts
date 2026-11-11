export type VoiceKey = 'encourage.empty' | 'encourage.all' | 'encourage.some' | 'encourage.fresh'

const LINES: Record<VoiceKey, string> = {
  'encourage.empty': 'Nothing is scheduled today.',
  'encourage.all': 'All done today. Nice work!',
  'encourage.some': 'Keep going, you are on a roll.',
  'encourage.fresh': 'A fresh day. Start with one thing.',
}

export const say = (key: VoiceKey): string => LINES[key]

/** The line under the Today headline: it fits how much of the day is done. */
export function heroLine(done: number, total: number): string {
  if (total === 0) return say('encourage.empty')
  if (done >= total) return say('encourage.all')
  if (done > 0) return say('encourage.some')
  return say('encourage.fresh')
}

// Lines for the game layer.
export const levelUpLine = (n: number): string => `LEVEL UP! You reached level ${n}!`
export const partyLevelLine = (n: number): string => `Party level ${n}! Together you are unstoppable.`
export const badgeLine = (name: string): string => `Badge unlocked: ${name}`
export const cheerLine = (name: string): string => `${name} cheered you on today!`
export const bossLine = (name: string): string => `Boss defeated: ${name}!`
export const restUsedLine = 'Rest day used. The streak lives on.'
