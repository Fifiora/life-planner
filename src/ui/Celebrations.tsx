import { useEffect, useState } from 'react'
import { useGame } from '../data/useGame'
import { useHousehold } from '../data/household'
import { useIncrease } from '../data/useIncrease'
import { BADGES } from '../lib/badges'
import { hasSeen, isFirstRun, markSeen } from '../lib/seen'
import { badgeLine, bossLine, levelUpLine, partyLevelLine } from '../lib/voice'
import { Confetti } from './Confetti'
import { useToast } from './Toast'

const nameOf = (id: string) => BADGES.find((b) => b.id === id)?.name ?? id

/** Cheers for a new level or badge, once per phone. Quiet on a first load; a lot arriving at once is summed up in one toast. */
export function Celebrations() {
  const game = useGame()
  const { readOnly } = useHousehold()
  const toast = useToast()
  const [count, setCount] = useState(0)
  const sparkle = useIncrease(count)
  const { on, meId } = game
  const level = game.me.level
  const partyLevel = game.party.level
  const badges = game.me.badges.join(',')
  const bossWeek = game.boss.week
  const bossName = game.boss.boss.name
  const bossDown = game.boss.progress.defeated

  useEffect(() => {
    if (!on || readOnly) return
    const keys: string[] = []
    const lines: string[] = []
    const bossKey = `boss:${bossWeek}`
    if (bossDown) {
      keys.push(bossKey)
      if (!hasSeen(bossKey)) lines.push(bossLine(bossName))
    }
    // Only the highest new level is announced, however many were crossed.
    let newest = 0
    for (let n = 2; n <= level; n++) {
      keys.push(`level:${meId}:${n}`)
      if (!hasSeen(`level:${meId}:${n}`)) newest = n
    }
    if (newest) lines.push(levelUpLine(newest))
    let newestParty = 0
    for (let n = 2; n <= partyLevel; n++) {
      keys.push(`party:${n}`)
      if (!hasSeen(`party:${n}`)) newestParty = n
    }
    if (newestParty) lines.push(partyLevelLine(newestParty))
    for (const id of badges ? badges.split(',') : []) {
      keys.push(`badge:${meId}:${id}`)
      if (!hasSeen(`badge:${meId}:${id}`)) lines.push(badgeLine(nameOf(id)))
    }
    const first = isFirstRun()
    markSeen(...keys)
    if (first || lines.length === 0) return
    // Three lines fit in a toast; beyond that the rest are summed up, never dropped silently.
    toast((lines.length > 3 ? [...lines.slice(0, 2), `and ${lines.length - 2} more!`] : lines).join(' '))
    setCount((c) => c + 1)
  }, [on, readOnly, meId, level, partyLevel, badges, bossWeek, bossName, bossDown, toast])

  return <Confetti fire={sparkle} />
}
