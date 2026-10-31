import type { Daypart } from './daypart'

export type PipMood = 'sleepy' | 'happy' | 'hyped' | 'proud'

/** How Pip, the mascot, feels about the day so far. The first rule that fits wins. */
export function pipMood({ done, total, streak, part }: { done: number; total: number; streak: number; part: Daypart }): PipMood {
  if (total > 0 && done >= total) return 'proud'
  if (streak >= 3 || (total > 0 && done / total >= 0.5)) return 'hyped'
  if (done === 0 && (part === 'morning' || part === 'evening')) return 'sleepy'
  return 'happy'
}
