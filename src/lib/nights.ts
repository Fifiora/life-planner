import type { NightOption, NightVote } from '../types'

/**
 * The option with the most votes, or null for no options, no votes, or a tie.
 * Each member has one vote: their latest vote in the list replaces earlier ones.
 */
export function pickWinner(options: NightOption[], votes: NightVote[]): string | null {
  const latestByMember = new Map<string, string>()
  for (const v of votes) latestByMember.set(v.member_id, v.option_id)

  const counts = new Map<string, number>(options.map((o) => [o.id, 0]))
  for (const optionId of latestByMember.values()) {
    if (counts.has(optionId)) counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
  }

  let best = 0
  let bestId: string | null = null
  let tied = false
  for (const [id, n] of counts) {
    if (n > best) {
      best = n
      bestId = id
      tied = false
    } else if (n === best && n > 0) {
      tied = true
    }
  }
  return best === 0 || tied ? null : bestId
}
