import { useEffect, useState } from 'react'
import { useGame } from '../data/useGame'
import { useHousehold } from '../data/household'
import { useIncrease } from '../data/useIncrease'
import { BADGES } from '../lib/badges'
import { hasSeen, isFirstRun, markSeen } from '../lib/seen'
import { badgeLine, levelUpLine, partyLevelLine } from '../lib/voice'
import { Confetti } from './Confetti'
import { useToast } from './Toast'

const nameOf = (id: string) => BADGES.find((b) => b.id === id)?.name ?? id

/** Cheers for a new level or badge, once per phone. Quiet on a first load and when a lot arrives at once (an import or a first sync). */
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

  useEffect(() => {
    if (!on || readOnly) return
    const items: { key: string; line: string }[] = []
    for (let n = 2; n <= level; n++) items.push({ key: `level:${meId}:${n}`, line: levelUpLine(n) })
    for (let n = 2; n <= partyLevel; n++) items.push({ key: `party:${n}`, line: partyLevelLine(n) })
    for (const id of badges ? badges.split(',') : []) items.push({ key: `badge:${meId}:${id}`, line: badgeLine(nameOf(id)) })
    const first = isFirstRun()
    const fresh = items.filter((i) => !hasSeen(i.key))
    markSeen(...fresh.map((i) => i.key))
    if (first || fresh.length === 0 || fresh.length > 3) return
    toast(fresh.map((i) => i.line).join(' '))
    setCount((c) => c + 1)
  }, [on, readOnly, meId, level, partyLevel, badges, toast])

  return <Confetti fire={sparkle} />
}
