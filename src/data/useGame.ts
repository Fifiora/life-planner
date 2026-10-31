import { useMemo } from 'react'
import { earnedBadges } from '../lib/badges'
import { levelFor, levelProgress, memberXp, partyXp, type GameData } from '../lib/xp'
import type { Activity, Bill, BillPayment, Milestone, Routine, RoutineLog, TriviaAttempt } from '../types'
import { useStyleChoice } from '../ui/StyleSwitch'
import { useHousehold } from './household'
import { useTable } from './useTable'

/** XP, levels and badges for me and for the two of us, worked out from what is already saved and synced. */
export function useGame() {
  const on = useStyleChoice() === 'anime'
  const { me, members } = useHousehold()
  const routines = useTable<Routine>('routines').rows
  const logs = useTable<RoutineLog>('routine_logs').rows
  const activities = useTable<Activity>('activities').rows
  const milestones = useTable<Milestone>('milestones').rows
  const attempts = useTable<TriviaAttempt>('trivia_attempts').rows
  const payments = useTable<BillPayment>('bill_payments').rows
  const bills = useTable<Bill>('bills').rows

  return useMemo(() => {
    const data: GameData = { routines, logs, activities, milestones, attempts, payments, bills }
    const memberIds = members.map((m) => m.id)
    const mine = memberXp(data, me.id)
    const party = partyXp(data, memberIds)
    return {
      on,
      meId: me.id,
      memberIds,
      data,
      me: { xp: mine.total, level: levelFor(mine.total), progress: levelProgress(mine.total), byBucket: mine.byBucket, badges: earnedBadges(data, me.id, memberIds) },
      party: { xp: party, level: levelFor(party), progress: levelProgress(party) },
    }
  }, [on, me.id, members, routines, logs, activities, milestones, attempts, payments, bills])
}
