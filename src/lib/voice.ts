import type { StyleChoice } from './style'

export type VoiceKey = 'encourage.empty' | 'encourage.all' | 'encourage.some' | 'encourage.fresh'

const LINES: Record<StyleChoice, Record<VoiceKey, string>> = {
  classic: {
    'encourage.empty': 'Nothing is scheduled today.',
    'encourage.all': 'All done today. Nice work!',
    'encourage.some': 'Keep going, you are on a roll.',
    'encourage.fresh': 'A fresh day. Start with one thing.',
  },
  anime: {
    'encourage.empty': 'Quiet day. Recharge for the next episode.',
    'encourage.all': 'Cleared! Pip is doing a victory dance.',
    'encourage.some': 'Power rising! Keep the combo going.',
    'encourage.fresh': 'New episode, new chance. Land the first hit.',
  },
}

export const say = (style: StyleChoice, key: VoiceKey): string => LINES[style][key]

/** The line under the Today headline: it fits how much of the day is done. */
export function heroLine(style: StyleChoice, done: number, total: number): string {
  if (total === 0) return say(style, 'encourage.empty')
  if (done >= total) return say(style, 'encourage.all')
  if (done > 0) return say(style, 'encourage.some')
  return say(style, 'encourage.fresh')
}

// Lines for the game layer. Classic never shows it, so these have no plain twin.
export const levelUpLine = (n: number): string => `LEVEL UP! You reached level ${n}!`
export const partyLevelLine = (n: number): string => `Party level ${n}! Together you are unstoppable.`
export const badgeLine = (name: string): string => `Badge unlocked: ${name}`
export const cheerLine = (name: string): string => `${name} cheered you on today!`
export const bossLine = (name: string): string => `Boss defeated: ${name}!`
export const restUsedLine = 'Rest day used. The streak lives on.'
